package main

import (
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"hash/fnv"
	"sort"
)

// ---------------------- Strategy Interface ----------------------

type BalancingStrategy interface {
	Init([]*Backend)
	GetNextBackend(IncomingReq) *Backend
	RegisterBackend(*Backend)
	PrintTopology()
}

// ---------------------- Simple Hash Strategy ----------------------
// hash the key and use the hash value to determine the backend

type SimpleHashStrategy struct {
	Backends []*Backend
}

func NewSimpleHashStrategy(backends []*Backend) *SimpleHashStrategy {
	s := new(SimpleHashStrategy)
	s.Init(backends)
	return s
}

func (s *SimpleHashStrategy) Init(backends []*Backend) {
	s.Backends = backends
}

func (s *SimpleHashStrategy) GetNextBackend(req IncomingReq) *Backend {
	n := len(s.Backends)
	if n == 0 {
		return nil
	}
	h := fnv.New32a()
	_, _ = h.Write([]byte(req.key)) // stable key (e.g., client IP)
	idx := int(h.Sum32() % uint32(n))
	return s.Backends[idx]
}

func (s *SimpleHashStrategy) RegisterBackend(backend *Backend) {
	s.Backends = append(s.Backends, backend)
}

func (s *SimpleHashStrategy) PrintTopology() {
	for i, b := range s.Backends {
		fmt.Printf("[%d] %s\n", i, b)
	}
}

// ---------------------- Round Robin Strategy ----------------------
// incrementally increase the index by 1 for each request

type RRBalancingStrategy struct {
	Index    int
	Backends []*Backend
}

func NewRRBalancingStrategy(backends []*Backend) *RRBalancingStrategy {
	strategy := new(RRBalancingStrategy)
	strategy.Init(backends)
	return strategy
}

func (s *RRBalancingStrategy) Init(backends []*Backend) {
	s.Index = 0
	s.Backends = backends
}

func (s *RRBalancingStrategy) GetNextBackend(_ IncomingReq) *Backend {
	if len(s.Backends) == 0 {
		return nil
	}
	s.Index = (s.Index + 1) % len(s.Backends)
	return s.Backends[s.Index]
}

func (s *RRBalancingStrategy) RegisterBackend(backend *Backend) {
	s.Backends = append(s.Backends, backend)
}

func (s *RRBalancingStrategy) PrintTopology() {
	for index, backend := range s.Backends {
		fmt.Println(fmt.Sprintf("[%d] %s", index, backend))
	}
}

// ---------------------- Static Strategy ----------------------
// Used to pin all request to the same backend

type StaticBalancingStrategy struct {
	Index    int
	Backends []*Backend
}

func NewStaticBalancingStrategy(backends []*Backend) *StaticBalancingStrategy {
	strategy := new(StaticBalancingStrategy)
	strategy.Init(backends)
	return strategy
}

func (s *StaticBalancingStrategy) Init(backends []*Backend) {
	s.Index = 0
	s.Backends = backends
}

func (s *StaticBalancingStrategy) GetNextBackend(_ IncomingReq) *Backend {
	if len(s.Backends) == 0 {
		return nil
	}
	return s.Backends[s.Index]
}

func (s *StaticBalancingStrategy) RegisterBackend(backend *Backend) {
	s.Backends = append(s.Backends, backend)
}

func (s *StaticBalancingStrategy) PrintTopology() {
	for index, backend := range s.Backends {
		mark := " "
		if index == s.Index {
			mark = "x"
		}
		fmt.Println(fmt.Sprintf("[%d] %s %s", index, mark, backend))
	}
}

// ---------------------- Consistent Hashing (real ring) ----------------------

type ConsistentHashStrategy struct {
	keys       []uint32   // sorted ring positions
	backends   []*Backend // parallel to keys
	totalSlots uint64     // fixed hash space (independent of #nodes)
}

func NewConsistentHashStrategy(backends []*Backend) *ConsistentHashStrategy {
	s := &ConsistentHashStrategy{totalSlots: 1 << 32}
	s.Init(backends)
	return s
}

func (s *ConsistentHashStrategy) Init(backends []*Backend) {
	s.keys = s.keys[:0]
	s.backends = s.backends[:0]
	for _, b := range backends {
		k := chPos(b.String(), s.totalSlots)
		s.insert(k, b)
	}
}

func (s *ConsistentHashStrategy) RegisterBackend(b *Backend) {
	k := chPos(b.String(), s.totalSlots)
	s.insert(k, b)
}

func (s *ConsistentHashStrategy) PrintTopology() {
	for i := range s.backends {
		fmt.Printf("[%10d] %s\n", s.keys[i], s.backends[i])
	}
}

func (s *ConsistentHashStrategy) GetNextBackend(req IncomingReq) *Backend {
	if len(s.backends) == 0 {
		return nil
	}
	slot := chPos(req.key, s.totalSlots)
	// first node strictly to the right of slot; wrap
	i := sort.Search(len(s.keys), func(i int) bool { return s.keys[i] > slot })
	return s.backends[i%len(s.backends)]
}

func (s *ConsistentHashStrategy) insert(k uint32, b *Backend) {
	i := sort.Search(len(s.keys), func(i int) bool { return s.keys[i] >= k })
	if i == len(s.keys) {
		s.keys = append(s.keys, k)
		s.backends = append(s.backends, b)
		return
	}
	s.keys = append(s.keys[:i+1], s.keys[i:]...)
	s.keys[i] = k
	s.backends = append(s.backends[:i+1], s.backends[i:]...)
	s.backends[i] = b
}

func chPos(key string, totalSlots uint64) uint32 {
	sum := sha256.Sum256([]byte(key))
	v := binary.BigEndian.Uint32(sum[:4])
	if totalSlots == 0 {
		return v
	}
	return uint32(uint64(v) % totalSlots)
}

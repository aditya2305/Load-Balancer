package main

import (
	"fmt"
	"io"
	"log"
	"net"
	"strings"

	"github.com/google/uuid"
)

// ----- event names -----
const (
	CMD_Exit           = "exit"
	CMD_BackendAdd     = "backend:add"
	CMD_BackendRemove  = "backend:remove"
	CMD_StrategyChange = "strategy:change"
	CMD_ShowMapping    = "mapping:show"
)

// ---------------------- Structs ----------------------

type Backend struct {
	Host        string
	Port        int
	IsHealthy   bool
	NumRequests int
}

func (b *Backend) String() string { return fmt.Sprintf("%s:%d", b.Host, b.Port) }

type Event struct {
	EventName string
	Data      interface{} // Backend (add), int (port) for remove, string for strategy, or nil
}

type LB struct {
	backends []*Backend
	events   chan Event
	strategy BalancingStrategy

	// demo keys to visualize stickiness & churn
	demoKeys []string
}

type IncomingReq struct {
	srcConn net.Conn
	reqId   string
	key     string
}

var lb *LB

// ---------------------- Initialization ----------------------

func InitLB() {
	backends := []*Backend{
		{Host: "localhost", Port: 8081, IsHealthy: true},
		{Host: "localhost", Port: 8082, IsHealthy: true},
		{Host: "localhost", Port: 8083, IsHealthy: true},
		{Host: "localhost", Port: 8084, IsHealthy: true},
	}

	lb = &LB{
		events:   make(chan Event),
		backends: backends,
		// default to proper consistent hashing (ring)
		strategy: NewConsistentHashStrategy(backends),
		demoKeys: []string{
			"10.0.0.1", "10.0.0.2", "10.0.0.3", "10.0.0.4",
			"10.0.0.5", "10.0.0.6", "10.0.0.7", "10.0.0.8",
			"10.0.0.9", "10.0.0.10", "10.0.0.11", "10.0.0.12",
		},
	}
}

// ---------------------- Run ----------------------

func (lb *LB) Run() {
	listener, err := net.Listen("tcp", ":9090")
	if err != nil {
		panic(err)
	}
	defer listener.Close()

	log.Println("LB listening on port 9090 ...")

	// control-plane event loop
	go func() {
		for {
			select {
			case event := <-lb.events:
				switch event.EventName {

				case CMD_Exit:
					log.Println("Gracefully terminating ...")
					return

				case CMD_BackendAdd:
					before := lb.snapshot()
					backend, ok := event.Data.(Backend)
					if !ok {
						panic("invalid backend data")
					}
					lb.backends = append(lb.backends, &backend)
					lb.strategy.Init(lb.backends)
					lb.printRemap("ADD", before, lb.snapshot())

				case CMD_BackendRemove:
					before := lb.snapshot()
					port, ok := event.Data.(int)
					if !ok {
						panic("invalid remove data")
					}
					if lb.removeBackend("localhost", port) {
						lb.strategy.Init(lb.backends)
						lb.printRemap("REMOVE", before, lb.snapshot())
					} else {
						log.Printf("no backend found on port %d", port)
					}

				case CMD_StrategyChange:
					before := lb.snapshot()
					name, ok := event.Data.(string)
					if !ok {
						panic("invalid strategy name")
					}
					switch name {
					case "round-robin", "rr":
						lb.strategy = NewRRBalancingStrategy(lb.backends)
					case "static":
						lb.strategy = NewStaticBalancingStrategy(lb.backends)
					case "simple", "simple-hash":
						lb.strategy = NewSimpleHashStrategy(lb.backends)
					case "ch", "hash", "consistent-hash":
						lb.strategy = NewConsistentHashStrategy(lb.backends)
					default:
						lb.strategy = NewConsistentHashStrategy(lb.backends)
					}
					lb.printRemap("STRATEGY:"+name, before, lb.snapshot())

				case CMD_ShowMapping:
					cur := lb.snapshot()
					lb.printRemap("SHOW", nil, cur)
				}
			}
		}
	}()

	// data-plane: accept and proxy
	for {
		connection, err := listener.Accept()
		if err != nil {
			log.Printf("Unable to accept connection: %s", err.Error())
			continue
		}

		// Spawn goroutine per connection
		go lb.proxy(IncomingReq{
			srcConn: connection,
			reqId:   uuid.NewString(),
			// NOTE: when testing locally, using client IP will stick to one backend (always ::1).
			// To visualize distribution, we use a random UUID as the key for now.
			// key:     clientIP(connection.RemoteAddr().String()),
			key: uuid.NewString(),
		})
	}
}

// ---------------------- Proxy Logic ----------------------

func (lb *LB) proxy(req IncomingReq) {
	backend := lb.strategy.GetNextBackend(req)
	if backend == nil {
		_, _ = req.srcConn.Write([]byte("no backend available"))
		_ = req.srcConn.Close()
		return
	}
	log.Printf("in-req: %s key=%s -> backend: %s", req.reqId, req.key, backend.String())

	backendConn, err := net.Dial("tcp", fmt.Sprintf("%s:%d", backend.Host, backend.Port))
	if err != nil {
		log.Printf("Error connecting to backend: %s", err.Error())
		_, _ = req.srcConn.Write([]byte("backend not available"))
		_ = req.srcConn.Close()
		return
	}
	backend.NumRequests++

	go io.Copy(backendConn, req.srcConn)
	go io.Copy(req.srcConn, backendConn)
}

// ---------------------- Helpers: mapping & diffs ----------------------

func (lb *LB) snapshot() map[string]string {
	m := make(map[string]string, len(lb.demoKeys))
	for _, k := range lb.demoKeys {
		b := lb.strategy.GetNextBackend(IncomingReq{key: k})
		if b != nil {
			m[k] = b.String()
		} else {
			m[k] = "<nil>"
		}
	}
	return m
}

func (lb *LB) printRemap(what string, before, after map[string]string) {
	log.Printf("=== %s ===", what)
	moved := 0
	for _, k := range lb.demoKeys {
		a := after[k]
		if before != nil {
			b := before[k]
			flag := ""
			if b != a {
				flag = "  <-- MOVED"
				moved++
			}
			log.Printf("key=%-12s  %s -> %s%s", k, b, a, flag)
		} else {
			log.Printf("key=%-12s  -> %s", k, a)
		}
	}
	if before != nil {
		log.Printf("moved=%d/%d keys", moved, len(lb.demoKeys))
	}
}

func (lb *LB) removeBackend(host string, port int) bool {
	idx := -1
	for i, b := range lb.backends {
		if b.Host == host && b.Port == port {
			idx = i
			break
		}
	}
	if idx == -1 {
		return false
	}
	lb.backends = append(lb.backends[:idx], lb.backends[idx+1:]...)
	return true
}

// clientIP extracts the IP from "ip:port" or "[v6]:port"
func clientIP(remote string) string {
	if i := strings.LastIndex(remote, ":"); i != -1 {
		ip := remote[:i]
		return strings.Trim(ip, "[]")
	}
	return remote
}

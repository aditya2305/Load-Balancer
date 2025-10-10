# Load Balancer (Round Robin / Simple Hash / Consistent Hashing)

A lightweight **TCP load balancer** written in Go that demonstrates multiple balancing strategies:

- **Round Robin** - even per-request distribution  
- **Simple Hash** - sticky by key (`hash(key) % N`)  
- **Consistent Hash (ring)** - sticky and low-churn under node changes  
- **Static** - pin all traffic to one backend (useful for debugging/canary)

It includes a built-in **REPL (Read-Eval-Print Loop)** so you can **add/remove backends** and **switch strategies at runtime**, while visualizing how **keys move** after each change.

---

## Features

- L4 (TCP) proxy on **:9090**
- Pluggable strategies:
  - Round Robin
  - Simple Hash
  - Consistent Hash
  - Static
- Live **control-plane REPL** (interactive command-line interface)
  - `add <port>` / `rm <port>`
  - `strat rr|simple|ch|static`
  - `show` → prints key → backend mapping
- Key-movement diff after every change (**visualizes churn**)
- Minimal HTTP backend servers for testing on ports **8081–8084**

---

## Project Structure

```text
loadbalancer/
├── backend/
│   └── backend.go    # simple HTTP server used as a backend
├── lb.go             # load balancer core (proxy, events, diffs)
├── main.go           # REPL + LB bootstrap
├── strategy.go       # strategies (RR, SimpleHash, ConsistentHash, Static)
├── go.mod
└── go.sum
```

---

## Architecture

### Data Plane
- `lb.Run()` listens on port `:9090`.
- Accepts TCP connections.
- Selects a backend via the **active strategy**.
- Proxies data bidirectionally using `io.Copy`.

### Control Plane (REPL → Events)
A goroutine consumes events from `lb.events`:
- `CMD_BackendAdd` / `CMD_BackendRemove`
- `CMD_StrategyChange`
- `CMD_ShowMapping`

After each change, the LB logs a **before/after** mapping for demo keys to show **how many keys moved**.

### Demo Keys
`10.0.0.1 … 10.0.0.12` - used to visualize **stickiness** and **churn** via `show`.

---

## Strategies

| Strategy | Mental Model | Pros | Cons | Sticky? |
|----------|--------------|------|------|---------|
| **Round Robin** | Deal cards in a circle | Even request distribution; simple | No affinity | No |
| **Simple Hash** | `idx = hash(key) % N` | Easy sticky routing | High churn when N changes | Yes |
| **Consistent Hash (Ring)** | Servers & keys on a ring; pick first clockwise | Sticky + low churn on add/remove | Slightly more complex; replicas recommended for smoothing | Yes |
| **Static** | Pin to one backend | Debug/canary/drain | No balancing | Yes (global) |

---

## How Consistent Hashing Works Here

The consistent hashing implementation is based on the concepts explained in [this article by Arpit Bhayani](https://arpitbhayani.me/blogs/consistent-hashing/).

1. Hash backends (by `"host:port"`) into a fixed **32-bit ring** (SHA-256 → first 4 bytes).  
2. Hash the **request key** (e.g., client IP, user ID) to a ring position.  
3. Route to the **first server strictly clockwise** from the key (wrap if needed).  
4. Adding/removing a node only moves keys in that node's **adjacent arc** (→ minimal churn).

---

## Run

### Start the Backends (in 4 terminals)

```bash
cd backend
go run backend.go -port 8081
go run backend.go -port 8082
go run backend.go -port 8083
go run backend.go -port 8084
```

### Start the Load Balancer (with REPL)

From the project root:

```bash
go run main.go lb.go strategy.go
```

You'll see the REPL help menu:

```text
commands:
  show                      -> print key->backend mapping
  strat rr|simple|ch|static -> change strategy
  add <port>                -> add backend localhost:<port>
  rm <port>                 -> remove backend localhost:<port>
  exit                      -> stop LB
```

### Send Client Requests (from another terminal)

```bash
for i in {1..10}; do curl -s http://localhost:9090/; done
```

**Note:**
For local testing, `lb.go` sets `key: uuid.NewString()` per connection to simulate multiple clients.
If you want real stickiness by client IP, change it to:

```go
key: clientIP(connection.RemoteAddr().String())
```

From localhost (`::1`), you'll always hit the same backend.

---

## Using the REPL (Live Testing)

**REPL** stands for **Read-Eval-Print Loop**, an interactive programming environment that reads user commands, evaluates them, prints the results, and loops back for the next command. In this load balancer, the REPL allows you to control the load balancer in real-time without restarting it.

### Show Current Mapping

```bash
> show
```

Prints each demo key and which backend it maps to.

### Switching Strategies

```bash
> strat rr
> show
> strat simple
> show
> strat ch
> show
```

- **RR** will rotate per request (no stickiness).
- **Simple Hash** and **Consistent Hash** will stick per key, use `show` to compare mappings.

### Add / Remove a Backend

```bash
> add 8085
> rm 8083
```

You'll see diffs:

```text
=== ADD ===
key=10.0.0.1    localhost:8082 -> localhost:8085  <-- MOVED
...
moved=3/12 keys
```

- **Consistent Hash** - few keys move (only the affected ring arc).
- **Simple Hash** - many keys move (since `% N` changes).

### Exit

```bash
> exit
```

---

## Implementation

### `strategy.go`

#### SimpleHashStrategy
- Hashes `req.key` using FNV-1a (32-bit).
- Picks `idx = hash % len(backends)`.
- Sticky and simple
- High churn when backends change.

#### RRBalancingStrategy
- Uses cyclic counter:
  ```go
  index = (index + 1) % len(backends)
  ```
- Even spread
- No stickiness.

#### StaticBalancingStrategy
- Always returns `backends[Index]` (default 0).
- Useful for debugging, canary tests, or draining nodes.

#### ConsistentHashStrategy
- Keeps two sorted slices in sync:
  - `keys []uint32` → ring positions
  - `backends []*Backend` → corresponding servers
- Hash positions with:
  ```go
  chPos(s) = SHA256("host:port") → first 4 bytes → uint32
  ```
- Routing:
  - `sort.Search` for first `key > slot`
  - wrap via `i % len(backends)`
- Adding/removing a backend → `Init()` rebuilds topology.

### `lb.go`
- TCP accept loop → one goroutine per connection.
- Generates random key (`uuid.NewString()`) to simulate clients.
- Proxies client ↔ backend via `io.Copy`.
- Uses REPL-driven events to dynamically:
  - Add/remove backends
  - Switch strategies
  - Print before/after mappings

---

## Run Guide

### Round Robin

```bash
> strat rr
```

Then run:

```bash
for i in {1..8}; do curl -s http://localhost:9090/; done
```

You'll see rotation:

```text
Hello from backend :8081
Hello from backend :8082
Hello from backend :8083
Hello from backend :8084
```

### Simple Hash

```bash
> strat simple
> show
> add 8085
> show
```

You'll see many keys move after add/remove.

### Consistent Hash

```bash
> strat ch
> show
> add 8085
> rm 8083
> show
```

You'll see only a few keys move, proving low churn.

---

## References

- [Consistent Hashing - What It Is and How to Implement It](https://arpitbhayani.me/blogs/consistent-hashing/)
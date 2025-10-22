# Custom Load Balancer & Visualizer

An interactive **web application** that demonstrates multiple load balancing strategies through real-time visualization:

- **Round Robin** - even per-request distribution  
- **Simple Hash** - sticky by key (`hash(key) % N`)  
- **Consistent Hash (ring)** - sticky and low-churn under node changes  
- **Static** - pin all traffic to one backend (useful for debugging/canary)

The application includes a **visual ring interface** so you can **add/remove servers** and **switch strategies at runtime**, while seeing exactly **how keys move** after each change in real-time.

---

## Features

- **Interactive Ring Visualization** - see servers arranged around a ring with real-time routing
- **Live Key Assignment Tracking** - watch which keys are assigned to which servers
- **Churn Analysis** - before/after comparison showing key movement when topology changes
- **Multiple Strategies**:
  - Round Robin
  - Simple Hash  
  - Consistent Hash
  - Static
- **Real-time Controls**:
  - Add/Remove servers dynamically
  - Switch strategies instantly
  - Fire requests with custom or random keys
  - Clear and reset functionality

---

## How to Use the Application

### Understanding the Interface

The application is divided into three main sections:

#### **1. Control Panel (Top Row)**
- **Initialization**: Set up 3-6 servers, add/remove servers, reset everything
- **Traffic & Strategy**: Enter keys, select load balancing strategy, fire requests
- **Legend**: Visual guide explaining the interface elements

#### **2. Ring Visualizer (Middle)**
- **Central Blue Circle**: Click to fire requests (source)
- **Server Nodes**: Arranged around the ring, showing:
  - Port number (8081, 8082, etc.)
  - Number of assigned keys
  - Green highlighting for last routed server
- **Animated Arrow**: Shows the path from source to target server

#### **3. Analysis Panels (Bottom Row)**
- **Key Assignments Table**: Shows which keys are assigned to which servers
- **Churn Analysis**: Displays key movement when servers are added/removed

---

## Load Balancing Strategies Explained

| Strategy | Mental Model | Pros | Cons | Sticky? |
|----------|--------------|------|------|---------|
| **Round Robin** | Deal cards in a circle | Even request distribution; simple | No affinity | No |
| **Simple Hash** | `idx = hash(key) % N` | Easy sticky routing | High churn when N changes | Yes |
| **Consistent Hash (Ring)** | Servers & keys on a ring; pick first clockwise | Sticky + low churn on add/remove | Slightly more complex; replicas recommended for smoothing | Yes |
| **Static** | Pin to one backend | Debug/canary/drain | No balancing | Yes (global) |

---

## How to Test Each Strategy

### **Round Robin**
1. Select "Round Robin" from the strategy dropdown
2. Click "Fire" multiple times
3. **Observe**: Each request goes to the next server in sequence (1→2→3→4→1...)
4. **Key Insight**: No stickiness - same key can go to different servers

### **Simple Hash**
1. Select "Simple Hash" from the strategy dropdown
2. Enter a key like "10.0.0.1" and click "Fire" multiple times
3. **Observe**: Same key always goes to the same server (sticky)
4. **Test Churn**: Add a server, then check the churn table
5. **Key Insight**: Many keys move when server count changes

### **Consistent Hash**
1. Select "Consistent Hash" from the strategy dropdown
2. Fire several requests with different keys
3. **Test Churn**: Add a server, then check the churn table
4. **Key Insight**: Only a few keys move when servers are added/removed

### **Static**
1. Select "Static" from the strategy dropdown
2. Choose a server index (0-3)
3. Fire requests with any keys
4. **Observe**: All requests go to the selected server regardless of key

---

## Understanding Consistent Hashing

The consistent hashing implementation demonstrates the concepts from [this article by Arpit Bhayani](https://arpitbhayani.me/blogs/consistent-hashing/).

### How It Works:
1. **Virtual Ring**: Each server gets 64 virtual positions on a hash ring
2. **Key Hashing**: Request keys are hashed to ring positions
3. **Clockwise Routing**: Route to the first server clockwise from the key's position
4. **Minimal Movement**: Adding/removing servers only affects keys in adjacent ring segments

### Why It's Better:
- **Simple Hash**: When you add a server, `hash(key) % N` changes for most keys → massive redistribution
- **Consistent Hash**: Only keys in the new server's virtual range move → minimal churn

---

## Interactive Learning Scenarios

### **Scenario 1: Understanding Sticky Sessions**
1. Use "Simple Hash" strategy
2. Fire requests with key "user123"
3. **Observe**: Always goes to the same server
4. Switch to "Round Robin"
5. Fire requests with same key "user123"
6. **Observe**: Goes to different servers each time

### **Scenario 2: Comparing Churn**
1. **Setup**: Fire 10+ requests with different keys using "Simple Hash"
2. **Add Server**: Click "Add Server"
3. **Check Churn**: Look at the "Churn (Before → After)" table
4. **Repeat with Consistent Hash**: Reset, fire requests, add server
5. **Compare**: Notice how many fewer keys moved with Consistent Hash

### **Scenario 3: Server Removal Impact**
1. **Setup**: Fire requests to populate all servers
2. **Remove Server**: Click "Remove Server"
3. **Observe**: 
   - Simple Hash: Most keys redistribute
   - Consistent Hash: Only keys from removed server move to next server

### **Scenario 4: Round Robin Behavior**
1. Select "Round Robin"
2. Fire 8 requests with the same key
3. **Observe**: Requests cycle through servers 1→2→3→4→1→2→3→4
4. **Key Insight**: Round Robin ignores the key completely

---

## Technical Implementation Details

### **Simple Hash Strategy**
```typescript
function simpleHashPick(servers: Server[], key: string): Server | null {
  if (servers.length === 0) return null;
  const idx = hash32(key) % servers.length;  // Direct modulo
  return servers[idx];
}
```
- **Pros**: Simple, sticky
- **Cons**: High churn when server count changes

### **Consistent Hash Strategy**
```typescript
function chPickServer(servers: Server[], keyStr: string): Server | null {
  const pairs = ringPositions(servers);  // 64 virtual replicas per server
  const slot = hash32(keyStr);
  
  // Binary search to find first position >= slot
  let lo = 0, hi = pairs.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (pairs[mid].key >= slot) hi = mid; else lo = mid + 1;
  }
  return pairs[lo % pairs.length].server;
}
```
- **Pros**: Sticky + minimal churn
- **Cons**: More complex, requires virtual replicas for smooth distribution

### **Round Robin Strategy**
```typescript
// Stateful index that advances on each request
const [rrIndex, setRrIndex] = useState(0);

function fire() {
  const s = servers[rrIndex % servers.length];
  setRrIndex((i) => (i + 1) % servers.length);
  // ... route to server s
}
```
- **Pros**: Even distribution, simple
- **Cons**: No stickiness

---

## Key Learning Outcomes

After using this application, you'll understand:

1. **Sticky vs Non-Sticky**: How different strategies handle session affinity
2. **Churn Impact**: Why consistent hashing is preferred for distributed systems
3. **Visual Learning**: See load balancing concepts in action rather than just reading about them
4. **Real-world Scenarios**: How server additions/removals affect different strategies
5. **Trade-offs**: When to use each strategy based on your requirements


package main

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
)

func main() {
	InitLB()

	go func() {
		sc := bufio.NewScanner(os.Stdin)
		help := func() {
			fmt.Println(`commands:
  show                      -> print key->backend mapping for demo keys
  strat rr|simple|ch|static -> change strategy (round-robin, simple hash, consistent hash, static)
  add <port>                -> add backend localhost:<port>
  rm <port>                 -> remove backend localhost:<port>
  exit                      -> stop LB
`)
		}
		help()
		for {
			fmt.Print("> ")
			if !sc.Scan() {
				return
			}
			line := strings.TrimSpace(sc.Text())
			if line == "" {
				continue
			}
			parts := strings.Fields(line)
			cmd := strings.ToLower(parts[0])

			switch cmd {
			case "show":
				lb.events <- Event{EventName: CMD_ShowMapping}

			case "strat", "strategy":
				if len(parts) < 2 {
					fmt.Println("usage: strat rr|simple|ch|static")
					continue
				}
				lb.events <- Event{EventName: CMD_StrategyChange, Data: strings.ToLower(parts[1])}

			case "add":
				if len(parts) < 2 {
					fmt.Println("usage: add <port>")
					continue
				}
				p, err := strconv.Atoi(parts[1])
				if err != nil {
					fmt.Println("invalid port")
					continue
				}
				lb.events <- Event{
					EventName: CMD_BackendAdd,
					Data:      Backend{Host: "localhost", Port: p, IsHealthy: true},
				}

			case "rm", "remove":
				if len(parts) < 2 {
					fmt.Println("usage: rm <port>")
					continue
				}
				p, err := strconv.Atoi(parts[1])
				if err != nil {
					fmt.Println("invalid port")
					continue
				}
				lb.events <- Event{EventName: CMD_BackendRemove, Data: p}

			case "exit", "quit":
				lb.events <- Event{EventName: CMD_Exit}
				return

			case "help", "h", "?":
				help()

			default:
				fmt.Println("unknown command; type 'help'")
			}
		}
	}()

	// start the data plane
	lb.Run()
}

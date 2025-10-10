package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
)

func main() {
	port := flag.Int("port", 8081, "port to listen on")
	flag.Parse()

	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Hello from backend :%d (path=%s)\n", *port, r.URL.Path)
	})

	addr := fmt.Sprintf(":%d", *port)
	log.Printf("backend listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}

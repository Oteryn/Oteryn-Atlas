#!/usr/bin/env python3
"""Transparent local TCP bridge for Docker Desktop -> LAN publication access."""

from __future__ import annotations

import argparse
import socket
import socketserver
import threading


class ForwardingTCPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

    def __init__(self, server_address: tuple[str, int], upstream: tuple[str, int]):
        self.upstream = upstream
        super().__init__(server_address, ForwardingHandler)


class ForwardingHandler(socketserver.BaseRequestHandler):
    def handle(self) -> None:
        upstream = socket.create_connection(self.server.upstream, timeout=15)
        upstream.settimeout(None)
        self.request.settimeout(None)

        def pump(source: socket.socket, target: socket.socket) -> None:
            try:
                while True:
                    chunk = source.recv(1024 * 1024)
                    if not chunk:
                        break
                    target.sendall(chunk)
            except (ConnectionError, OSError):
                pass
            finally:
                try:
                    target.shutdown(socket.SHUT_WR)
                except OSError:
                    pass

        client_to_upstream = threading.Thread(
            target=pump, args=(self.request, upstream), daemon=True
        )
        client_to_upstream.start()
        pump(upstream, self.request)
        client_to_upstream.join(timeout=2)
        upstream.close()


def self_test() -> None:
    class EchoHandler(socketserver.BaseRequestHandler):
        def handle(self) -> None:
            while True:
                data = self.request.recv(65536)
                if not data:
                    return
                self.request.sendall(data)

    with socketserver.ThreadingTCPServer(('127.0.0.1', 0), EchoHandler) as upstream:
        upstream.daemon_threads = True
        upstream_thread = threading.Thread(target=upstream.serve_forever, daemon=True)
        upstream_thread.start()
        with ForwardingTCPServer(('127.0.0.1', 0), upstream.server_address) as forwarder:
            forwarder_thread = threading.Thread(target=forwarder.serve_forever, daemon=True)
            forwarder_thread.start()
            payload = b'OTERYN-ATLAS-LOCAL-FORWARDER-SELF-TEST' * 1024
            with socket.create_connection(forwarder.server_address, timeout=5) as client:
                client.sendall(payload)
                received = bytearray()
                while len(received) < len(payload):
                    chunk = client.recv(65536)
                    if not chunk:
                        break
                    received.extend(chunk)
            if bytes(received) != payload:
                raise SystemExit('SELF-TEST FAIL: relayed bytes differ')
            forwarder.shutdown()
        upstream.shutdown()
    print('SELF-TEST PASS')


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--listen-host', default='127.0.0.1')
    parser.add_argument('--listen-port', type=int)
    parser.add_argument('--upstream-host')
    parser.add_argument('--upstream-port', type=int)
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    if not args.listen_port or not args.upstream_host or not args.upstream_port:
        parser.error('--listen-port, --upstream-host and --upstream-port are required')
    with ForwardingTCPServer(
        (args.listen_host, args.listen_port),
        (args.upstream_host, args.upstream_port),
    ) as server:
        print(
            f'FORWARDER READY {args.listen_host}:{args.listen_port} -> '
            f'{args.upstream_host}:{args.upstream_port}',
            flush=True,
        )
        server.serve_forever(poll_interval=0.25)


if __name__ == '__main__':
    main()

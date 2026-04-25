While a **Service** (specifically `LoadBalancer` or `NodePort`) can expose your application to the outside world, **Ingress** provides a more powerful and flexible way to manage external access to your services.

## What is Ingress?

Ingress is an API object that manages external access to the services in a cluster, typically HTTP. It can provide load balancing, SSL termination, and name-based virtual hosting.

Think of it as a set of rules that allow inbound connections to reach the cluster services.

## Why Use Ingress?

Using an Ingress is often more cost-effective and manageable than creating multiple `LoadBalancer` services. 

- **Consolidation:** You can route multiple services through a single entry point (and a single IP/Load Balancer).
- **Path-Based Routing:** Route traffic based on the URL path (e.g., `example.com/api` goes to one service, `example.com/web` to another).
- **Host-Based Routing:** Route traffic based on the domain name (e.g., `app1.example.com` and `app2.example.com`).
- **TLS/SSL Termination:** Handle encryption at the Ingress level instead of in every individual service.

## How it Works: The Controller

An Ingress resource on its own does nothing. You must have an **Ingress Controller** running in your cluster to satisfy the Ingress. Common controllers include `ingress-nginx`, AWS Load Balancer Controller, or Traefik.

## A Simple Ingress Example

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: minimal-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx-example
  rules:
  - http:
      paths:
      - path: /testpath
        pathType: Prefix
        backend:
          service:
            name: test
            port:
              number: 80
```

This rule says that any traffic coming to the cluster on `/testpath` should be sent to the service named `test` on port 80.

## Summary

Ingress is the go-to solution for exposing complex web applications in Kubernetes. It provides the routing logic and security features needed for production-grade traffic management.

For more details, visit the [official Kubernetes Ingress documentation](https://kubernetes.io/docs/concepts/services-networking/ingress/).

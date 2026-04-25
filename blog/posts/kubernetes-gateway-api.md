For years, **Ingress** has been the standard for managing external traffic in Kubernetes. But as clusters grew more complex, the limitations of Ingress—its lack of expressiveness and its "one-size-fits-all" approach—became apparent. Enter the **Gateway API**.

## What is the Gateway API?

The Gateway API is a collection of resources (GatewayClass, Gateway, HTTPRoute, etc.) that model service networking in Kubernetes. It’s designed to be the successor to Ingress, providing a more powerful and flexible way to manage traffic.

## Why the Evolution?

1.  **Role-Oriented Design:** Ingress often forced cluster operators and developers to fight over the same resource. Gateway API separates concerns:
    *   **Infrastructure Provider:** Defines `GatewayClass`.
    *   **Cluster Operator:** Manages `Gateway` (the entry point).
    *   **Application Developer:** Manages `HTTPRoute` (routing logic).
2.  **Expressiveness:** Ingress relied heavily on custom annotations for things like header matching or traffic splitting. Gateway API builds these features directly into the spec.
3.  **Extensibility:** It supports different protocols (TCP, UDP, TLS) through specific route resources, not just HTTP.

## The Core Resources

-   **GatewayClass:** Defines a template for Gateways (e.g., "internet-facing-alb" or "internal-nginx").
-   **Gateway:** The actual point where traffic is received and translated to services. It defines *where* to listen.
-   **Routes (HTTPRoute, TCPRoute, etc.):** Defines *how* traffic is routed from a Gateway to a backend Service.

## A Simple HTTPRoute Example

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: my-app-route
spec:
  parentRefs:
  - name: my-gateway
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /api
    backendRefs:
    - name: my-api-service
      port: 8080
```

This `HTTPRoute` attaches itself to `my-gateway` and routes all `/api` traffic to `my-api-service`.

## Summary

The Gateway API isn't just "Ingress v2"—it's a fundamental shift toward a more collaborative and capable networking model. While Ingress isn't going away yet, Gateway API is the future of how we expose applications in Kubernetes.

For a deeper dive, explore the [official Kubernetes Gateway API documentation](https://kubernetes.io/docs/concepts/services-networking/gateway/).

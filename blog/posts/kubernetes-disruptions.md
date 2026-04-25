---
title: "Kubernetes Disruptions: Protecting Application Availability"
category: Kubernetes
date: 2026-04-24
tags: Kubernetes, Workloads, Pods, Availability, Infrastructure
summary: Understanding voluntary and involuntary disruptions and how to use Pod Disruption Budgets (PDBs) to ensure your app stays online during maintenance.
---

# Kubernetes Disruptions: Protecting Application Availability

In a large Kubernetes cluster, Pods will inevitably go down. Some of these events are predictable, while others are not. To build highly available systems, you need to understand the two types of **Disruptions** and how to protect against them.

## 1. Involuntary Disruptions

These are unavoidable hardware or system failures that you cannot control.

-   **Examples:** A hardware failure on a physical node, a kernel panic, or a network partition.
-   **Mitigation:** Kubernetes handles these by automatically rescheduling Pods onto healthy nodes. You can improve resilience by using **ReplicaSets** and **anti-affinity rules** to ensure Pods are spread across different nodes and racks.

## 2. Voluntary Disruptions

These are initiated by cluster administrators or automated tools.

-   **Examples:** Draining a node for a kernel upgrade, updating a Deployment's pod template, or deleting a Pod manually.
-   **Mitigation:** This is where **Pod Disruption Budgets (PDBs)** come into play.

## Pod Disruption Budgets (PDBs)

A PDB allows you to limit the number of Pods of a replicated application that can be down simultaneously due to voluntary disruptions.

```text
[ Application: my-web-app ]
[ Pod 1 ] [ Pod 2 ] [ Pod 3 ] [ Pod 4 ]
    |         |         |         |
    +---------+---------+---------+
              |
      [ PDB: minAvailable: 3 ]
              |
              v
"If an admin tries to 'kubectl drain' a node 
 holding Pod 1, Kubernetes will ALLOW it. 
 If they then try to drain the node holding Pod 2, 
 Kubernetes will BLOCK it until Pod 1 is back up."
```

## How to Define a PDB

You can specify the budget using `minAvailable` or `maxUnavailable`.

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: my-pdb
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: my-app
```

-   **minAvailable:** The minimum number of Pods that must stay running.
-   **maxUnavailable:** The maximum number of Pods that can be taken down.

## The Eviction API

When a tool (like `kubectl drain`) wants to remove a Pod, it uses the **Eviction API** rather than a direct delete. The Eviction API checks all existing PDBs. If an eviction would violate a budget, it is rejected with a `429 Too Many Requests` error.

```text
Admin -> [ Evict Pod A ] -> [ API Server ]
                                |
          +---[ Check PDBs ]----+
          |                     |
     ( Budget OK? )       ( Budget Violated? )
          |                     |
     [ Proceed ]           [ Reject: 429 ]
```

## Best Practices

1.  **Always use PDBs for critical apps:** Even if you have 10 replicas, an automated upgrade might try to take down 5 at once if you haven't defined a budget.
2.  **Don't set `minAvailable` to 100%:** If you have 3 replicas and set `minAvailable: 3`, you will never be able to drain a node holding one of those pods.
3.  **Use `maxUnavailable: 1`:** This is a safe default for most small-to-medium deployments, as it ensures Pods are updated or moved one at a time.

## Conclusion

Understanding disruptions is the difference between a "cloud-native" app and a fragile one. By combining ReplicaSets for involuntary failures and PDBs for voluntary ones, you ensure that your services remain available even when the underlying infrastructure is in flux.

For more technical details on eviction and corner cases, check out the [official Kubernetes Disruptions documentation](https://kubernetes.io/docs/concepts/workloads/pods/disruptions/).

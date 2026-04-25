# Kubernetes Scheduling Groups: Native Gang Scheduling

For years, users running machine learning (ML) or high-performance computing (HPC) workloads on Kubernetes had to rely on external plugins (like Volcano) to achieve **Gang Scheduling**. But with the introduction of the **Scheduling Group** API (Alpha in v1.35), this capability is finally coming to the native `kube-scheduler`.

## The Problem: Resource Deadlocks

In distributed training (like MPI or PyTorch), you often need *all* workers to start at the same time to perform a computation. If you have 10 workers but only enough resources for 5, a standard scheduler might start those 5 and leave the other 5 pending. 

The first 5 workers will sit idle, waiting for their peers, while holding onto resources that *other* jobs could use. This is a classic resource deadlock.

```text
[ Cluster Capacity: 5 Slots ]
[ Job A: Needs 10 Slots ]

( Without Scheduling Groups )
Node 1: [ Worker A-1 ] [ Worker A-2 ] [ Worker A-3 ]
Node 2: [ Worker A-4 ] [ Worker A-5 ]
Node 3: (Empty, but not enough for A-6 through A-10)

Result: Job A is STUCK. 5 slots are WASTED.
```

## The Solution: PodGroups

A **PodGroup** defines a collection of Pods that should be treated as a single unit by the scheduler. 

### How it Works (Gang Policy)

When you use the `gang` scheduling policy, the scheduler will not place *any* Pods from the group until it finds available capacity for the entire `minCount`.

```text
[ Cluster Capacity: 5 Slots ]
[ Job A: PodGroup minCount: 10 ]

( With Scheduling Groups )
Scheduler: "I see 10 workers, but only 5 slots."
Scheduler: "I will HOLD all 10 workers in 'Pending'."

Result: 5 slots remain FREE for other, smaller jobs. 
        Job A waits until a full 10-slot window opens.
```

## How to Configure It

### 1. Create the PodGroup
First, define the group and its requirements.

```yaml
apiVersion: scheduling.k8s.io/v1alpha1
kind: PodGroup
metadata:
  name: training-job-1
spec:
  schedulingPolicy:
    gang:
      minCount: 10
```

### 2. Link Pods to the Group
In your Pod (or Job) template, reference the group using the `schedulingGroup` field.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: worker-0
spec:
  schedulingGroup:
    podGroupName: training-job-1
  containers:
  - name: train
    image: my-ml-app:latest
```

## Key Benefits

-   **Efficiency:** Prevents "zombie" Pods from hogging cluster resources while they wait for dependencies.
-   **Atomic Scheduling:** The entire group is evaluated in a single scheduling cycle, ensuring a consistent placement decision.
-   **Native Integration:** No need to manage complex third-party operators for basic gang scheduling needs.

## Current Limitations (Alpha)

As an Alpha feature, Scheduling Groups require the `GenericWorkload` feature gate to be enabled and the `PodGroup` API to be installed. The `schedulingGroup` field on a Pod is also **immutable**—once a Pod is assigned to a group, it cannot be changed.

## Conclusion

Scheduling Groups represent a major step forward for Kubernetes as a platform for big data and AI. By bringing gang scheduling into the core, Kubernetes is becoming even more capable of handling the most demanding distributed workloads in the world.

For the latest updates on the API and feature status, check out the [official Kubernetes Scheduling Group documentation](https://kubernetes.io/docs/concepts/workloads/pods/scheduling-group/).

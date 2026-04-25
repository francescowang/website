Upgrading a production database is one of the highest-risk operations in a platform engineer's toolkit. Get it wrong and you face extended downtime, data inconsistency, or an application that simply stops working. Amazon RDS for MySQL takes away a significant amount of that complexity — but only if you understand the model it uses, the distinctions between upgrade types, and the tools available to reduce blast radius.

This post covers everything you need to know: version semantics, minor vs. major upgrade paths, pre-upgrade testing, reduced-downtime strategies using Blue/Green Deployments, and how to monitor an upgrade as it happens.

---

## Understanding RDS MySQL Versioning

Before planning an upgrade, you need to understand what the version numbers actually mean in the context of RDS.

MySQL uses a three-part version scheme:

```sh
  8  .  0  .  36
  ^     ^      ^
  |     |      |
Major  Minor  Patch
```

- **Major version** (e.g. 5.7 → 8.0): new features, potential breaking changes, requires manual intervention, significant testing
- **Minor version** (e.g. 8.0.28 → 8.0.36): bug fixes, security patches, backwards compatible within the major line
- **Patch / RDS-specific**: AWS may append their own qualifier (`8.0.36.rds.20240101`) for internal fixes specific to the managed service

### The `rds.` Version Suffix

When you query `@@version` on an RDS instance you may see a string like:

```sh
8.0.36
```

But running `SHOW VARIABLES LIKE 'rds%';` or inspecting the RDS console reveals the full internal build, which includes an RDS-specific qualifier:

```sh
8.0.36.rds.20240315
```

This RDS suffix allows AWS to ship urgent fixes (e.g. for a critical CVE) within the same community MySQL version, without bumping the minor version. You cannot control or manually select the RDS qualifier — AWS manages it. What you specify in the console or CLI is the community version number (e.g. `8.0.36`).

---

## Minor vs. Major Upgrades — The Core Distinction

```sh
MINOR UPGRADE (within a major line)
─────────────────────────────────────────────────────────
  MySQL 8.0.28  ──────────────►  MySQL 8.0.36
      │                                │
      │  - Fully backwards compatible  │
      │  - Can be automated            │
      │  - Short maintenance window    │
      │  - No app changes needed       │
      └────────────────────────────────┘

MAJOR UPGRADE (crossing a major boundary)
─────────────────────────────────────────────────────────
  MySQL 5.7.x   ──────────────►  MySQL 8.0.x
      │                                │
      │  - Breaking changes possible   │
      │  - Must be manual              │
      │  - Longer downtime expected    │
      │  - App + schema testing needed │
      └────────────────────────────────┘
```

This distinction drives every other decision in the upgrade process.

---

## Minor Version Upgrades

### Auto Minor Version Upgrade (AMVU)

RDS supports an `Auto Minor Version Upgrade` setting on each DB instance. When enabled, AWS automatically applies approved minor version upgrades during your scheduled maintenance window. You do not need to do anything.

```sh
  ┌───────────────────────────────────────────────┐
  │  RDS Instance                                 │
  │  Auto Minor Version Upgrade: ENABLED          │
  │                                               │
  │  Maintenance Window: Sun 03:00 – 04:00 UTC    │
  └──────────────────────────────┬────────────────┘
                                 │
                                 │  (AWS detects approved minor version)
                                 ▼
                     ┌───────────────────────┐
                     │  During maintenance   │
                     │  window:              │
                     │  8.0.28 → 8.0.36      │
                     │  ~minutes of downtime │
                     └───────────────────────┘
```

**Best practice:** Enable AMVU for non-production environments. For production, keep it disabled and handle upgrades deliberately so you control the timing.

### Manually Triggering a Minor Upgrade

You can trigger a minor upgrade at any time using the console, CLI, or Terraform:

```sh
# AWS CLI
aws rds modify-db-instance \
  --db-instance-identifier mydb \
  --engine-version 8.0.36 \
  --apply-immediately

# Terraform (triggers during next maintenance window unless apply_immediately = true)
resource "aws_db_instance" "mydb" {
  engine_version       = "8.0.36"
  allow_major_version_upgrade = false
  apply_immediately    = false
}
```

**`apply-immediately` vs. `apply during maintenance window`:**

```sh
  apply-immediately = true
  ─────────────────────────
  Starts upgrade now → brief downtime during business hours
  Use with caution in production

  apply-immediately = false (default)
  ─────────────────────────────────────
  Queued until next maintenance window → controlled downtime
  Recommended for production
```

---

## Major Version Upgrades

### What Changes in a Major Upgrade

MySQL 5.7 → 8.0 is the most common major upgrade path teams face today. Key breaking changes include:

- Default authentication plugin changed from `mysql_native_password` to `caching_sha2_password`
- Removed functions and reserved words (e.g. `YEAR(2)` data type removed)
- JSON handling changes
- `utf8mb3` vs `utf8mb4` charset differences
- `GROUP BY` implicit sort removed
- `INFORMATION_SCHEMA` and `PERFORMANCE_SCHEMA` structural changes

### The Major Upgrade Path

RDS only allows you to upgrade one major version at a time. You cannot jump from 5.7 directly to 8.4.

```sh
  MySQL 5.7  ──►  MySQL 8.0  ──►  MySQL 8.4  ──►  ...
      │               │               │
      │               │               │
   (manual)        (manual)        (manual)
   + testing       + testing       + testing
```

Attempting to skip a version will result in an API error. Plan your roadmap accordingly if you are multiple major versions behind.

### Pre-Upgrade Checks RDS Runs Automatically

Before a major upgrade begins, RDS runs its own precondition checks. If any fail, the upgrade is blocked and an event is logged. Common blockers include:

- Incompatible objects or data types in user schemas
- Non-native authentication plugins in use
- Read replicas that are not on a supported version
- Pending parameter group changes not yet applied
- The instance has an unreachable state

You can trigger these checks manually before scheduling the real upgrade:

```sh
aws rds modify-db-instance \
  --db-instance-identifier mydb \
  --engine-version 8.0.36 \
  --allow-major-version-upgrade \
  --no-apply-immediately
```

Review the `Events` tab in the console or subscribe to the `db-instance` event category for any precondition failures.

---

## Pre-Upgrade Testing: The Snapshot Workflow

Never run a major upgrade for the first time on your production instance. The recommended approach is:

```sh
  ┌─────────────────────────────────────────────────────────────────┐
  │                   PRE-UPGRADE TESTING WORKFLOW                  │
  └─────────────────────────────────────────────────────────────────┘

  Step 1: Snapshot Production
  ───────────────────────────
  Production DB (8.0.28)
          │
          ▼  Create Manual Snapshot
  ┌───────────────────┐
  │  Snapshot         │
  │  mydb-pre-upgrade │
  └────────┬──────────┘
           │
           ▼  Restore to new instance

  Step 2: Restore + Upgrade Isolated Test Instance
  ─────────────────────────────────────────────────
  ┌────────────────────────────────────────────────┐
  │  Test Instance (mydb-upgrade-test)             │
  │  Restored from snapshot (5.7.x data)           │
  │                                                │
  │  Perform major upgrade: 5.7 → 8.0              │
  │  Same instance class, same param group         │
  └───────────────────────┬────────────────────────┘
                          │
                          ▼

  Step 3: Run Application Validation Tests
  ─────────────────────────────────────────
  ┌────────────────────────────────────────────────┐
  │  Point a staging app at mydb-upgrade-test      │
  │                                                │
  │  Run:                                          │
  │  ✓ Functional tests (reads, writes, joins)     │
  │  ✓ Auth + connection tests                     │
  │  ✓ Stored procedure / function tests           │
  │  ✓ ORM migration dry-runs                      │
  │  ✓ Query performance benchmarks                │
  └───────────────────────┬────────────────────────┘
                          │
               ┌──────────┴──────────┐
               ▼                     ▼
          Tests PASS             Tests FAIL
               │                     │
    Schedule production        Fix issues, re-snapshot
      upgrade during           and re-test from Step 1
    maintenance window
```

### What to Validate in Testing

**1. Authentication:** MySQL 8.0's default auth plugin is `caching_sha2_password`. Older clients may not support it. Test all application connection strings and confirm the driver version is compatible.

**2. SQL compatibility:** Run `mysqlcheck --check-upgrade` against your schemas on the test instance:

```sh
mysqlcheck \
  -h mydb-upgrade-test.xyz.rds.amazonaws.com \
  -u admin \
  -p \
  --all-databases \
  --check-upgrade
```

**3. Parameter group:** Create a new parameter group for the target major version. Parameter group families are version-specific — you cannot apply a `mysql5.7` parameter group to an `8.0` instance. Recreate all custom parameters in the new family before the upgrade.

```
  mysql5.7 parameter group  ──x──►  Cannot be applied to MySQL 8.0
  mysql8.0 parameter group  ──✓──►  Must be created and tested separately
```

**4. Read Replicas:** If your production instance has read replicas, each replica must be upgraded separately after the primary. RDS will block a primary upgrade if a replica is not on a compatible version. Plan your replica upgrade order before touching production.

---

## Reducing Downtime: Blue/Green Deployments

Standard upgrades take the instance offline for the duration of the upgrade — this can range from a few minutes (minor) to potentially 20–30+ minutes (major) depending on instance size and schema complexity. For workloads that cannot tolerate this, use **RDS Blue/Green Deployments**.

### How It Works

```sh
  ┌─────────────────────────────────────────────────────────────────────┐
  │                    BLUE/GREEN DEPLOYMENT FLOW                       │
  └─────────────────────────────────────────────────────────────────────┘

  PHASE 1: Create green environment
  ───────────────────────────────────────────────────────────────────────
  ┌─────────────────────┐          ┌─────────────────────┐
  │  BLUE (Production)  │  binlog  │  GREEN (Staging)    │
  │  MySQL 5.7.x        │ ────────►│  MySQL 8.0.x        │
  │  Accepting traffic  │  repl.   │  Receiving changes  │
  └─────────────────────┘          └─────────────────────┘
         ▲
         │
  App traffic (reads + writes)


  PHASE 2: Validate green
  ───────────────────────────────────────────────────────────────────────
  ┌─────────────────────┐          ┌─────────────────────┐
  │  BLUE               │          │  GREEN              │
  │  Still live         │          │  Run tests here     │
  │                     │◄─────────│  Point staging app  │
  └─────────────────────┘          └─────────────────────┘


  PHASE 3: Switchover (~seconds of downtime)
  ───────────────────────────────────────────────────────────────────────
                                   ┌─────────────────────┐
                    ┌──────────────│  GREEN (now Primary)│
                    │   Traffic    │  MySQL 8.0.x        │
                    │   switches   │  New production     │
  App ─────────────►│              └─────────────────────┘
                    │
  ┌─────────────────────┐
  │  BLUE (retained)    │
  │  Available for      │
  │  rollback if needed │
  └─────────────────────┘
```

### Key Properties of Blue/Green Deployments

| Property | Detail |
|---|---|
| Replication lag at switchover | Typically < 1 second |
| Switchover downtime | Usually under 1 minute |
| Rollback | Switch back to blue while green is retained |
| When to delete blue | After confirming green is stable (typically 24–72 hrs) |
| Cost | Blue + green both incur charges until blue is deleted |

### Switchover Behaviour

During switchover, RDS:
1. Waits for replication lag to reach near-zero
2. Stops writes to blue
3. Promotes green as the new primary
4. Updates the endpoint DNS to point to green
5. Keeps blue available in read-only mode for rollback

Your application does not need to change its connection string — the endpoint DNS resolves to the new instance after switchover.

### When to Use Blue/Green vs. Standard Upgrade

```sh
  Standard In-Place Upgrade
  ──────────────────────────
  ✓ Simple setup
  ✓ No extra cost
  ✗ Full downtime during upgrade
  → Use for: dev/staging, or prod with an acceptable maintenance window

  Blue/Green Deployment
  ──────────────────────────
  ✓ Seconds of downtime at switchover
  ✓ Full rollback option
  ✗ Runs two instances simultaneously (cost)
  ✗ More complex to set up
  → Use for: production with strict SLAs, or large instances where upgrade is slow
```

---

## Monitoring an Upgrade in Progress

### RDS Events

All upgrade activity is published as RDS events. Subscribe using SNS:

```sh
aws rds create-event-subscription \
  --subscription-name upgrade-alerts \
  --sns-topic-arn arn:aws:sns:eu-west-1:123456789012:rds-alerts \
  --source-type db-instance \
  --event-categories '["maintenance","notification"]' \
  --source-ids mydb
```

Key events to watch for:

| Event | Meaning |
|---|---|
| `DB instance upgrade precondition check failed` | Blocked — fix the issue before retrying |
| `DB instance upgrade started` | Upgrade is now running, instance is offline |
| `DB instance upgrade completed` | Upgrade finished successfully |
| `DB instance upgrade failed` | Upgrade failed — RDS attempts automatic rollback |

### CloudWatch Metrics During Upgrade

While the upgrade is running (in-place), the instance is unavailable and metrics will show:

```sh
  DatabaseConnections ──►  0  (instance offline)
  CPUUtilization      ──►  high spike during upgrade processing
  FreeStorageSpace    ──►  may decrease temporarily
  ReadLatency /
  WriteLatency        ──►  spikes, then normalise post-upgrade
```

For Blue/Green deployments, monitor the green environment's `ReplicaLag` metric:

```sh
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name ReplicaLag \
  --dimensions Name=DBInstanceIdentifier,Value=mydb-green \
  --start-time 2026-04-25T00:00:00Z \
  --end-time 2026-04-25T01:00:00Z \
  --period 60 \
  --statistics Average
```

Aim for `ReplicaLag < 1 second` before initiating switchover.

### Enhanced Monitoring

Enable Enhanced Monitoring (1-second granularity) before the upgrade to get OS-level metrics:

```sh
  Standard CloudWatch    → 60-second granularity, DB-level metrics
  Enhanced Monitoring    → 1-second granularity, OS + process-level
                           (CPU per thread, memory, file I/O, swap)
```

Enable it on the instance:

```sh
aws rds modify-db-instance \
  --db-instance-identifier mydb \
  --monitoring-interval 1 \
  --monitoring-role-arn arn:aws:iam::123456789012:role/rds-monitoring-role
```

---

## End-to-End: Recommended Upgrade Runbook

Bringing everything together, here is the recommended sequence for a production major version upgrade:

```sh
  ┌─────────────────────────────────────────────────────────────────┐
  │                  PRODUCTION UPGRADE RUNBOOK                     │
  └─────────────────────────────────────────────────────────────────┘

  ── 2 WEEKS BEFORE ────────────────────────────────────────────────
  [ ] Create target parameter group (e.g. mysql8.0 family)
  [ ] Recreate all custom parameters in new group
  [ ] Create snapshot of production
  [ ] Restore snapshot to test instance
  [ ] Run mysqlcheck --check-upgrade on test instance
  [ ] Run application test suite against test instance
  [ ] Identify and fix any compatibility issues

  ── 1 WEEK BEFORE ─────────────────────────────────────────────────
  [ ] Apply new parameter group to test instance
  [ ] Perform full major upgrade on test instance
  [ ] Run full regression tests
  [ ] Benchmark query performance (before vs. after)
  [ ] Confirm driver / ORM compatibility
  [ ] Schedule production maintenance window

  ── UPGRADE DAY ───────────────────────────────────────────────────
  [ ] Create final manual snapshot of production
  [ ] Enable Enhanced Monitoring (1-second interval)
  [ ] Create Blue/Green Deployment (if SLA requires < 1 min downtime)
  [ ] Perform upgrade on green environment
  [ ] Validate green with smoke tests
  [ ] Initiate switchover during low-traffic window
  [ ] Confirm application health post-switchover
  [ ] Monitor CloudWatch and RDS Events for 30 minutes

  ── 24–72 HOURS AFTER ─────────────────────────────────────────────
  [ ] Confirm no regression in error rates or latency
  [ ] Delete blue environment (stops billing for old instance)
  [ ] Delete test instance
  [ ] Update runbook / documentation
```

---

## Summary

Amazon RDS for MySQL abstracts away significant operational complexity, but it does not remove the need for a disciplined upgrade process. The key points to carry forward:

- **Minor upgrades** are low-risk and can be automated; major upgrades are never automatic
- **Version identifiers** include an AWS-specific suffix — what you specify is the community version
- **Test every major upgrade** using a snapshot-restore-validate cycle before touching production
- **Parameter groups** are version-family-specific — create the target group before the upgrade
- **Blue/Green Deployments** reduce switchover downtime to seconds and provide a rollback path
- **Monitor actively** using RDS Events, CloudWatch metrics, and Enhanced Monitoring during and after the upgrade

A well-prepared upgrade is a non-event. The preparation is the work.

# AWS RDS MySQL vs PostgreSQL: A Comprehensive Guide

> **Who this is for:** Developers, architects, and data engineers choosing between MySQL and PostgreSQL on AWS RDS — or anyone wanting to deeply understand the trade-offs between the two most popular open-source relational databases.

---

## Table of Contents

1. [The 30-Second Summary](#the-30-second-summary)
2. [Glossary: Key Buzzwords Explained](#glossary-key-buzzwords-explained)
3. [What is AWS RDS?](#what-is-aws-rds)
4. [Core Architecture Differences](#core-architecture-differences)
5. [Feature Comparison](#feature-comparison)
6. [Data Types](#data-types)
7. [Performance](#performance)
8. [Security Best Practices](#security-best-practices)
9. [Observability & Monitoring](#observability--monitoring)
10. [Pros and Cons](#pros-and-cons)
11. [When to Use MySQL](#when-to-use-mysql)
12. [When to Use PostgreSQL](#when-to-use-postgresql)
13. [Decision Framework](#decision-framework)
14. [Trade-offs Summary Table](#trade-offs-summary-table)
15. [Analogies](#analogies)
16. [Common Pitfalls to Avoid](#common-pitfalls-to-avoid)
17. [Migration Considerations](#migration-considerations)

---

## The 30-Second Summary

| | MySQL | PostgreSQL |
|---|---|---|
| **Best described as** | Fast, simple, widely supported | Powerful, standards-compliant, extensible |
| **Analogy** | A reliable Toyota Corolla | A configurable Land Rover |
| **Best for** | Web apps, CMSes, high read workloads | Complex queries, analytics, JSON, GIS |
| **Learning curve** | Lower | Steeper |
| **Ecosystem maturity** | Very mature, massive community | Mature, fast-growing community |
| **AWS Aurora compatible** | Yes (Aurora MySQL) | Yes (Aurora PostgreSQL) |

---

## Glossary: Key Buzzwords Explained

Understanding these terms will make the rest of this guide much clearer.

### ACID
**Atomicity, Consistency, Isolation, Durability.** The four properties that guarantee reliable database transactions.
- **Atomicity:** A transaction is all-or-nothing. If you transfer £100 from Account A to B, either both the debit and credit happen, or neither does.
- **Consistency:** The database always moves from one valid state to another.
- **Isolation:** Concurrent transactions don't interfere with each other.
- **Durability:** Once committed, data survives crashes.

Both MySQL (InnoDB engine) and PostgreSQL are fully ACID-compliant.

### MVCC (Multi-Version Concurrency Control)
A technique to handle concurrent reads and writes without locking. Instead of blocking readers when a writer is active, the database keeps multiple versions of a row. Think of it like Google Docs — multiple people can view the document at the same time while one person edits it, and everyone sees a consistent snapshot.

PostgreSQL's MVCC is considered more robust; MySQL's implementation (in InnoDB) can leave behind "dead rows" that require periodic cleanup (VACUUM in PostgreSQL handles this automatically).

### WAL (Write-Ahead Log)
Before changing data on disk, the database first writes the change to a log. If the system crashes, the log is replayed to recover. PostgreSQL uses WAL extensively and exposes it for replication. Think of it as a "change journal" — like a ship's log that records every manoeuvre before it's executed.

### Replication
Copying data from one database server (primary) to one or more others (replicas/read replicas). Used for high availability and read scaling.
- **Logical replication:** Replicates the logical changes (INSERT, UPDATE, DELETE).
- **Physical/streaming replication:** Replicates raw byte-level changes on disk.

### Sharding
Splitting a large database horizontally across multiple servers. Each "shard" holds a subset of the data (e.g., users A–M on shard 1, N–Z on shard 2).

### Index
A data structure that speeds up row lookups — like the index at the back of a book. Without one, the database reads every row (a "full table scan"). With one, it jumps directly to matching rows.

### Vacuum / Autovacuum (PostgreSQL)
PostgreSQL's MVCC leaves behind old row versions. VACUUM reclaims that space. Autovacuum does this automatically in the background. MySQL doesn't have this concept because its storage engine handles cleanup differently.

### JSONB vs JSON
- **JSON:** Stores JSON as raw text. Parsing happens at query time.
- **JSONB:** Stores JSON in a decomposed binary format. Indexable, faster to query. PostgreSQL's JSONB is a major differentiator.

### Extensions
Add-on modules that extend the database's capabilities. PostgreSQL has a rich extension ecosystem (PostGIS for GIS, pgcrypto for encryption, pg_trgm for fuzzy search, etc.). MySQL has a more limited plugin system.

### Connection Pooling
Databases have a maximum number of simultaneous connections. Connection pooling reuses existing connections instead of opening a new one for every request. Think of it like a taxi rank — cars (connections) wait and are reused rather than being summoned from scratch each time.

### RTO / RPO
- **RTO (Recovery Time Objective):** How long it takes to restore service after a failure.
- **RPO (Recovery Point Objective):** How much data you can afford to lose (e.g., "we can tolerate losing up to 5 minutes of data").

### IAM (Identity and Access Management)
AWS's system for controlling who can do what. RDS supports IAM database authentication, letting you use AWS credentials instead of static database passwords.

### Parameter Group
In RDS, a Parameter Group is a container of configuration settings (e.g., `max_connections`, `shared_buffers`) that you apply to a database instance. Like a settings profile.

### Multi-AZ
Running a primary database in one AWS Availability Zone with a synchronous standby replica in another. If the primary fails, AWS automatically fails over to the standby. This is for high availability, not read scaling.

---

## What is AWS RDS?

Amazon Relational Database Service (RDS) is a **managed database service**. AWS handles:
- Hardware provisioning
- OS patching
- Database software installation and patching
- Automated backups
- Failover (with Multi-AZ)
- Monitoring integration

You focus on schema design, queries, and application logic. You do **not** get OS-level SSH access to the underlying server.

**RDS is not the same as running MySQL/PostgreSQL on an EC2 instance.** The managed nature means some advanced configurations (e.g., custom kernel parameters, pg_upgrade in-place) are restricted or done differently.

---

## Core Architecture Differences

### MySQL Architecture

MySQL was originally designed for **speed and simplicity** in web applications. Key architectural traits:

- **Pluggable storage engine architecture:** MySQL separates the query layer from the storage layer. The most important engine is **InnoDB** (the default since MySQL 5.5), which provides ACID compliance, foreign keys, and row-level locking. Other engines exist (MyISAM, MEMORY) but are rarely used in production today.
- **Thread-based concurrency:** Each connection gets its own thread. This can be a bottleneck under very high connection counts.
- **Binary Log (binlog):** MySQL's replication and point-in-time recovery is based on the binary log, which records all data-changing statements (or row changes, depending on mode).

### PostgreSQL Architecture

PostgreSQL was designed from the ground up as a **full-featured, object-relational database** with correctness and extensibility as primary goals.

- **Process-based concurrency:** Each connection spawns a separate OS process. This uses more memory per connection than MySQL's thread model, which is why connection pooling (e.g., PgBouncer) is almost always used with PostgreSQL.
- **Unified storage engine:** No pluggable engines — PostgreSQL has one, battle-tested storage layer.
- **WAL-based replication:** Replication is built on the same Write-Ahead Log used for crash recovery, making it robust.
- **MVCC without lock escalation:** PostgreSQL never escalates row locks to table locks during normal DML, giving better concurrent write throughput in complex workloads.
- **Highly extensible:** Custom data types, custom operators, custom index access methods, procedural languages (PL/pgSQL, PL/Python, PL/Perl, etc.).

---

## Feature Comparison

| Feature | MySQL (RDS) | PostgreSQL (RDS) |
|---|---|---|
| **ACID compliance** | Yes (InnoDB) | Yes |
| **Foreign keys** | Yes (InnoDB) | Yes |
| **Full-text search** | Basic | Better (with `tsvector`/`tsquery`) |
| **JSON support** | JSON type (limited indexing) | JSON + JSONB (fully indexable) |
| **Array types** | No native arrays | Native array columns |
| **Window functions** | Yes (MySQL 8+) | Yes (more mature) |
| **CTEs (WITH queries)** | Yes (MySQL 8+) | Yes (since v8.4, very mature) |
| **Recursive CTEs** | Yes (MySQL 8+) | Yes |
| **Materialized views** | No | Yes |
| **Partial indexes** | No | Yes |
| **Expression indexes** | Limited | Yes |
| **GIS / spatial data** | Yes (basic) | Yes, excellent (PostGIS extension) |
| **Custom data types** | Limited | Yes (ENUM, composite, domain, range) |
| **Custom functions** | Yes | Yes (more languages: PL/pgSQL, Python, Perl, JS...) |
| **Extensions** | Limited plugins | Rich ecosystem (PostGIS, pgvector, pg_trgm, etc.) |
| **Logical replication** | Yes (binlog) | Yes (pglogical, built-in since v10) |
| **Read replicas (RDS)** | Yes (up to 15 with Aurora) | Yes (up to 15 with Aurora) |
| **Multi-AZ** | Yes | Yes |
| **Performance Insights** | Yes | Yes |
| **IAM authentication** | Yes | Yes |
| **SSL/TLS** | Yes | Yes |
| **Row-level security** | No | Yes |
| **Schema support** | Schemas = databases | True schemas within a database |
| **UPSERT** | `INSERT ... ON DUPLICATE KEY UPDATE` | `INSERT ... ON CONFLICT DO UPDATE` |
| **Parallel query** | Limited | Yes (configurable) |
| **Table inheritance** | No | Yes |
| **Unlogged tables** | No | Yes (for temp high-speed writes) |
| **pgvector (AI/ML)** | No | Yes (via extension) |

---

## Data Types

One of PostgreSQL's biggest advantages is its rich type system.

### MySQL Data Types (notable)
- `INT`, `BIGINT`, `FLOAT`, `DOUBLE`, `DECIMAL`
- `VARCHAR`, `TEXT`, `BLOB`
- `DATE`, `DATETIME`, `TIMESTAMP`
- `JSON` (stored as text, limited indexing)
- `ENUM`, `SET`

### PostgreSQL Data Types (notable additions)
- Everything MySQL has, plus:
- **`JSONB`** — Binary JSON, fully indexable
- **Arrays** — `TEXT[]`, `INT[]`, etc. — store a list in a single column
- **`UUID`** — Native UUID type with index support
- **`INET`, `CIDR`, `MACADDR`** — Network address types
- **Range types** — `daterange`, `int4range` (e.g., "is this date within this booking period?")
- **`HSTORE`** — Key-value store within a column (pre-JSONB)
- **`TSVECTOR`/`TSQUERY`** — Full-text search types
- **`GEOMETRY`/`GEOGRAPHY`** — Via PostGIS extension (industry-standard GIS)
- **Custom types** — Define your own composite or domain types
- **`VECTOR`** — Via pgvector extension (for AI embeddings / similarity search)

---

## Performance

### Where MySQL Tends to be Faster
- **Simple, high-volume read workloads** (e.g., serving web pages from a CMS)
- **Single-table lookups with primary key** — MySQL's InnoDB clustered index is extremely fast for PK lookups
- **High connection count with simple queries** — MySQL's thread model handles many short-lived simple queries efficiently
- **Write-heavy workloads with simple transactions** — MySQL's InnoDB has lower write amplification for simple inserts

### Where PostgreSQL Tends to be Faster
- **Complex queries with JOINs** — PostgreSQL's query planner is more sophisticated
- **Analytical workloads** — Better parallel query execution, materialised views, more advanced aggregations
- **Concurrent write workloads** — PostgreSQL's MVCC avoids lock contention better in complex scenarios
- **JSON workloads** — JSONB with GIN indexes dramatically outperforms MySQL's JSON handling
- **Full-text search** — PostgreSQL's native FTS is faster and more capable
- **Geospatial queries** — PostGIS is the gold standard

### RDS Instance Sizing Notes
- PostgreSQL uses more RAM per connection (process-based model). For workloads with hundreds of connections, use **PgBouncer** or RDS Proxy.
- MySQL can sustain more simultaneous connections on the same hardware for simple queries.
- Both benefit significantly from `db.r6g` (memory-optimised) instance classes for large working sets.
- For high-throughput workloads, consider **Aurora MySQL** or **Aurora PostgreSQL** instead of standard RDS — Aurora's distributed storage engine significantly increases IOPS.

---

## Security Best Practices

Security on RDS applies to both engines, but some specifics differ.

### Network Security
- **Always deploy RDS in a private subnet** — never expose the database endpoint to the public internet
- Use **VPC Security Groups** as the firewall — only allow inbound traffic from your application servers' security group, not from `0.0.0.0/0`
- Enable **VPC Flow Logs** to audit network traffic
- Use **AWS PrivateLink** or **VPC peering** when connecting from other VPCs or services

### Encryption
- Enable **encryption at rest** using AWS KMS when creating the instance (cannot be enabled on an existing unencrypted instance without snapshot restore)
- Enable **SSL/TLS in transit** — enforce it by setting `require_secure_transport=ON` (MySQL) or using `ssl_mode=verify-full` (PostgreSQL) in connection strings
- For PostgreSQL: use `pg_hba.conf` equivalent (managed via RDS parameter groups) to enforce SSL for all connections
- Rotate credentials regularly using **AWS Secrets Manager** with automatic rotation

### Authentication & Access Control
- Use **IAM database authentication** instead of static passwords where possible — credentials are short-lived tokens (15 minutes)
- Follow the principle of **least privilege** — create separate database users for each application, and only grant the permissions they need (e.g., a read-only analytics user, a read-write app user)
- **MySQL-specific:** Use `GRANT` statements carefully; MySQL's privilege system is per-database, per-table, per-column
- **PostgreSQL-specific:** Use **Row-Level Security (RLS)** to enforce data access policies at the database layer — e.g., "users can only see their own rows"
- Never use the master user (e.g., `admin`) for application connections
- Disable or delete unused database accounts

### PostgreSQL-Specific Security
- Use `pg_hba.conf` rules (configured via RDS options) to control which hosts can connect and with what authentication method
- Use **schemas** to isolate different applications' tables within the same database
- Audit with **pgaudit** extension — logs DML/DDL operations for compliance (PCI, HIPAA, SOC2)
- Use `REVOKE ALL ON SCHEMA public FROM PUBLIC` to tighten default permissions on new databases

### MySQL-Specific Security
- Enable the **audit plugin** (available on RDS MySQL via the `MYSQL_AUDIT_PLUGIN` option group) for compliance logging
- Be careful with `GRANT ALL` — MySQL has a global privilege hierarchy that can be unexpectedly permissive
- Enable `validate_password` plugin to enforce password complexity

### RDS Common Security Settings
- Enable **deletion protection** to prevent accidental instance deletion
- Enable **automated backups** and test restoration regularly
- Enable **CloudTrail** to log all RDS API calls (who created/deleted/modified instances)
- Use **RDS Proxy** to pool connections and enforce IAM authentication at the proxy layer
- Enable **Enhanced Monitoring** and **Performance Insights** (see Observability section)

---

## Observability & Monitoring

### AWS Native Tools

**Amazon CloudWatch Metrics** (available for both)
- `CPUUtilization` — if consistently above 80%, scale up or optimise queries
- `DatabaseConnections` — track connection exhaustion risk
- `FreeStorageSpace` — set alarms before you run out (auto-scaling storage is available)
- `ReadIOPS` / `WriteIOPS` — track storage throughput
- `ReadLatency` / `WriteLatency` — track I/O response time
- `FreeableMemory` — if low, the buffer pool is under pressure; scale up
- `ReplicaLag` — for read replicas; high lag means the replica is falling behind

**RDS Performance Insights**
The most valuable RDS observability tool. Shows:
- **DB Load** — how many active sessions are running vs waiting
- **Wait events** — what are sessions waiting for? (lock waits, I/O, CPU, network)
- **Top SQL** — the highest-load queries, with execution plan hints
- **Top hosts / users** — which clients are generating the most load

Always enable Performance Insights. It has a free 7-day retention tier.

**Enhanced Monitoring**
Real-time OS-level metrics (CPU per process, memory, file system, disk I/O) at up to 1-second granularity. Useful for diagnosing spikes that CloudWatch's 1-minute metrics miss.

### PostgreSQL-Specific Observability

**Key system views:**
```sql
-- Currently running queries
SELECT pid, now() - query_start AS duration, state, query
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY duration DESC;

-- Table bloat and autovacuum status
SELECT relname, n_dead_tup, last_autovacuum, last_autoanalyze
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;

-- Index usage
SELECT indexrelname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Slow queries (requires pg_stat_statements extension)
SELECT query, calls, total_exec_time / calls AS avg_ms, rows / calls AS avg_rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
```

**Recommended extensions for observability:**
- `pg_stat_statements` — tracks execution statistics for all SQL statements. Enable via RDS parameter group (`shared_preload_libraries = pg_stat_statements`)
- `pgaudit` — detailed audit logging
- `auto_explain` — automatically logs execution plans for slow queries

**Autovacuum monitoring** — neglecting this is a common PostgreSQL production issue:
```sql
-- Tables with stale statistics or high dead tuple counts
SELECT relname, n_dead_tup, n_live_tup,
       round(n_dead_tup::numeric/nullif(n_live_tup+n_dead_tup,0)*100, 2) AS dead_pct,
       last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY dead_pct DESC;
```

### MySQL-Specific Observability

**Key queries:**
```sql
-- Currently running queries
SHOW PROCESSLIST;

-- Slow query log (enable via parameter group: slow_query_log=1, long_query_time=1)
SELECT * FROM mysql.slow_log ORDER BY start_time DESC LIMIT 20;

-- InnoDB status (lock waits, buffer pool, etc.)
SHOW ENGINE INNODB STATUS\G

-- Index usage
SELECT table_name, index_name, stat_value
FROM mysql.innodb_index_stats
WHERE database_name = 'your_db';
```

**MySQL Performance Schema** — detailed low-level instrumentation:
```sql
-- Top wait events
SELECT event_name, count_star, sum_timer_wait/1e12 AS total_wait_s
FROM performance_schema.events_waits_summary_global_by_event_name
ORDER BY sum_timer_wait DESC
LIMIT 10;
```

### Third-Party Observability Tools
Both engines integrate well with:
- **Datadog** — RDS integration with automatic anomaly detection
- **Grafana + Prometheus** — Use `postgres_exporter` or `mysqld_exporter` for detailed dashboards
- **New Relic** — Database monitoring with query tracing
- **AWS DevOps Guru** — ML-powered anomaly detection for RDS

---

## Pros and Cons

### MySQL on RDS

**Pros:**
- Extremely mature and battle-tested for web workloads (LAMP/LEMP stack)
- Massive community, wealth of documentation, tutorials, and StackOverflow answers
- Lower barrier to entry — simpler mental model for beginners
- Better performance for very simple, high-volume read queries (e.g., key-value-style lookups)
- Wider support in off-the-shelf software (WordPress, Magento, Drupal, Joomla)
- MySQL 8.0 significantly closed the gap with PostgreSQL on advanced features
- Aurora MySQL offers exceptional throughput for write-heavy web workloads

**Cons:**
- Weaker JSON support compared to PostgreSQL's JSONB
- No row-level security natively
- No materialised views
- No partial or expression indexes
- Limited extension ecosystem
- Schema = database conflation (no true multi-schema within one database)
- `ALTER TABLE` can lock tables (though online DDL has improved)
- Full-text search is basic compared to PostgreSQL
- No support for array columns

### PostgreSQL on RDS

**Pros:**
- Best-in-class JSON/JSONB support with full indexing
- Rich type system (arrays, ranges, network types, custom types)
- Row-Level Security for fine-grained access control
- Materialised views for pre-computed query results
- Partial and expression indexes
- Superior query planner for complex queries
- Excellent GIS support via PostGIS
- Strong SQL standards compliance
- Rich extension ecosystem (pgvector for AI, PostGIS for maps, pgaudit for compliance, etc.)
- Better MVCC implementation — less lock contention
- More advanced replication options (logical replication, replication slots)

**Cons:**
- Higher memory usage per connection (process-based) — connection pooling is more of a necessity
- Autovacuum requires tuning and monitoring — can surprise teams that don't account for it
- Steeper learning curve — more concepts to understand (schemas, MVCC internals, planner behaviour)
- Some AWS-specific features lag MySQL (e.g., Aurora MySQL historically had more features than Aurora PostgreSQL, though this gap is narrowing)
- `EXPLAIN ANALYZE` and query planning can be harder to interpret for beginners

---

## When to Use MySQL

### Use MySQL when:

1. **Your application uses a CMS or off-the-shelf software** — WordPress, Drupal, Magento, and many other platforms are written for MySQL. Using MySQL means using the engine the software was tested against.

2. **Your team is already familiar with MySQL** — Switching databases mid-project is expensive. If your team knows MySQL well, the productivity advantage of staying on MySQL may outweigh PostgreSQL's technical advantages.

3. **You need maximum simplicity for a straightforward CRUD application** — A standard web app with users, products, orders, and sessions will work perfectly well on MySQL without needing any of PostgreSQL's advanced features.

4. **You are optimising for raw read throughput with simple queries** — MySQL can edge out PostgreSQL for simple primary-key lookups and basic reads in some benchmarks.

5. **You are using AWS Aurora and need the absolute highest write throughput** — Aurora MySQL has historically had a slight lead over Aurora PostgreSQL for certain write-heavy OLTP patterns, though this is workload-dependent.

6. **Your application relies on specific MySQL behaviours** — e.g., `AUTO_INCREMENT`, certain MySQL-specific SQL syntax, or the `INFORMATION_SCHEMA` layout.

---

## When to Use PostgreSQL

### Use PostgreSQL when:

1. **You need to store and query JSON/semi-structured data** — JSONB with GIN indexes makes PostgreSQL a partial replacement for document databases like MongoDB. Ideal for flexible schemas or event data.

2. **You need geospatial capabilities** — PostGIS on PostgreSQL is the gold standard for GIS in the relational world. If you're building anything with maps, locations, routing, or spatial analysis, use PostgreSQL + PostGIS.

3. **Your workload involves complex queries, analytics, or reporting** — CTEs, window functions, materialised views, parallel query, and a more sophisticated query planner make PostgreSQL shine for analytical workloads running on the same database.

4. **You need fine-grained access control at the row level** — Row-Level Security lets you enforce multi-tenant data isolation at the database layer, not just the application layer.

5. **You are building an AI/ML application that needs vector similarity search** — The `pgvector` extension turns PostgreSQL into a vector database for storing and querying AI embeddings (used in RAG, semantic search, recommendation systems).

6. **You need compliance features** — `pgaudit` provides detailed, auditable logging that satisfies PCI DSS, HIPAA, and SOC 2 requirements.

7. **You have a complex schema with inheritance or advanced type requirements** — Arrays, range types, custom composite types, and table inheritance are all native to PostgreSQL.

8. **You care deeply about SQL standards compliance** — PostgreSQL tracks the SQL standard more closely than MySQL.

9. **Your application requires full-text search** — PostgreSQL's `tsvector` and `tsquery` with GIN indexes provides a capable, low-dependency FTS solution without needing Elasticsearch for moderate scale.

---

## Decision Framework

Work through these questions in order:

```
1. Does your app use a specific CMS or framework tied to MySQL?
   → YES: Use MySQL

2. Do you need GIS / geospatial queries?
   → YES: Use PostgreSQL + PostGIS

3. Do you need to store and heavily query JSON/semi-structured data?
   → YES: Use PostgreSQL (JSONB)

4. Do you need AI/vector similarity search (pgvector)?
   → YES: Use PostgreSQL

5. Do you need row-level security for multi-tenancy?
   → YES: Use PostgreSQL

6. Is your workload primarily simple CRUD + high read traffic with a familiar MySQL team?
   → YES: Use MySQL

7. Is your workload analytical / reporting / complex JOINs?
   → YES: Use PostgreSQL

8. Do you need compliance audit logging (PCI, HIPAA, SOC2)?
   → YES: Use PostgreSQL (pgaudit) — though MySQL audit plugin can also work

9. None of the above — greenfield project, no strong preference?
   → Use PostgreSQL. It gives you more room to grow.
```

---

## Trade-offs Summary Table

| Scenario | Winner | Why |
|---|---|---|
| WordPress / Drupal / Magento | MySQL | Built and tested for MySQL |
| Simple REST API / CRUD app | Tie | Both work equally well |
| High-volume simple reads | MySQL (slight edge) | Faster for PK lookups |
| Complex JOINs / analytics | PostgreSQL | Better query planner |
| JSON document storage | PostgreSQL | JSONB >> MySQL JSON |
| Geospatial / maps | PostgreSQL | PostGIS is unmatched |
| Full-text search | PostgreSQL | More capable FTS |
| AI / vector search | PostgreSQL | pgvector extension |
| Multi-tenant row isolation | PostgreSQL | Row-Level Security |
| Compliance / audit logging | PostgreSQL (slight edge) | pgaudit is excellent |
| Very high connection count | MySQL (slight edge) | Thread model is cheaper per connection |
| Operations simplicity | MySQL (slight edge) | No autovacuum tuning needed |
| SQL standards compliance | PostgreSQL | More standards-conformant |
| Extension ecosystem | PostgreSQL | Far richer |
| Off-the-shelf software support | MySQL | Broader compatibility |
| Mature AWS Aurora features | Tie (was MySQL, gap closed) | Aurora PostgreSQL has caught up |

---

## Analogies

### The Kitchen Analogy

**MySQL is like a professional short-order cook.** They're incredibly fast, efficient, and reliable at cooking the standard menu — burgers, fries, pancakes. The kitchen is set up for high throughput, minimal fuss, and predictable results. It's not the place for molecular gastronomy, but it'll serve 500 covers a night without breaking a sweat.

**PostgreSQL is like a Michelin-star chef.** They can do everything the short-order cook can do, plus soufflés, fermented foams, and tasting menus. The kitchen has more specialised equipment (extensions), more complex techniques (advanced query planner), and a steeper apprenticeship. You'd choose them when the dish demands it.

---

### The Vehicle Analogy

**MySQL is a Toyota Corolla.** Reliable, fuel-efficient, easy to drive, well-documented, easy to get serviced anywhere. The right choice for 90% of journeys.

**PostgreSQL is a Range Rover with a tuned engine.** More capable on difficult terrain (complex queries, specialised data types), more configurable, but requires a more experienced driver to get the best out of it and more maintenance knowledge (autovacuum tuning, connection pooling).

---

### The Warehouse Analogy (MVCC)

Imagine a warehouse of records. When a change is made:

- **MySQL (InnoDB):** It modifies the record but keeps the old version in a separate "undo log" area in memory. Once no transactions need it, it's discarded.
- **PostgreSQL:** It writes the new version of the record right next to the old one on the shelf. Both exist simultaneously. Old versions are cleaned up later by the autovacuum janitor.

Both approaches give readers a consistent snapshot. PostgreSQL's approach is simpler and more predictable for readers, but requires the janitor (autovacuum) to clean up regularly.

---

### The Schema Analogy

**MySQL:** "Schema" and "database" are synonyms. A server has multiple databases. An application connects to one database. It's like a building with separate rooms — you can only be in one room at a time.

**PostgreSQL:** A server has databases, and each database has multiple **schemas** (namespaces). Think of it as a building with floors (databases), and each floor has multiple offices (schemas). You can query across offices on the same floor (`SELECT * FROM analytics.events JOIN public.users ON ...`) but not across floors. This enables multi-tenancy, cleaner separation of concerns, and permission management within a single database.

---

## Common Pitfalls to Avoid

### MySQL Pitfalls

- **Using MyISAM instead of InnoDB** — MyISAM doesn't support foreign keys or transactions. Always use InnoDB (the default). If you're inheriting an old database, check: `SELECT engine FROM information_schema.tables WHERE table_schema = 'your_db';`
- **Implicit type coercion** — MySQL is more permissive about type mismatches (e.g., comparing an INT column to a string). This can cause silent bugs and missed index usage.
- **`DATETIME` vs `TIMESTAMP`** — `DATETIME` stores literal date/time with no timezone; `TIMESTAMP` is stored in UTC and converted to the session timezone on read. Using `DATETIME` in multi-timezone apps causes subtle bugs.
- **Large `ALTER TABLE` operations** — On large tables, some `ALTER TABLE` commands lock the table. Use `pt-online-schema-change` or MySQL's `ALGORITHM=INPLACE` where possible.
- **Over-relying on `SELECT *`** — Returns all columns, bypasses covering indexes, increases network payload.

### PostgreSQL Pitfalls

- **Neglecting autovacuum** — Table bloat from dead tuples slows queries and bloats storage. Monitor `pg_stat_user_tables.n_dead_tup` and tune autovacuum thresholds for high-write tables.
- **Transaction ID wraparound** — PostgreSQL uses 32-bit transaction IDs. After ~2 billion transactions, it wraps around. Autovacuum prevents this, but neglected autovacuum on large tables can cause emergency freezing that locks the database. Monitor `age(datfrozenxid)` in `pg_database`.
- **Too many connections without pooling** — Each PostgreSQL connection is a process (~5–10 MB RAM). 500 connections = 2.5–5 GB just for connection overhead. Use **PgBouncer** or **RDS Proxy**.
- **Ignoring `EXPLAIN ANALYZE`** — PostgreSQL's query planner can occasionally choose a bad plan. Learn to read `EXPLAIN ANALYZE` output, and check for sequential scans on large tables.
- **`UPDATE` and bloat** — Every `UPDATE` in PostgreSQL creates a new row version. Frequent updates on hot rows cause table bloat. Consider `FILLFACTOR` tuning for write-heavy tables.

---

## Migration Considerations

### MySQL → PostgreSQL

This is a significant migration. Key challenges:

- **SQL dialect differences** — Auto-increment (`AUTO_INCREMENT` → `SERIAL` or `GENERATED ALWAYS AS IDENTITY`), string functions (`IFNULL` → `COALESCE`, `GROUP_CONCAT` → `STRING_AGG`), date functions differ
- **Case sensitivity** — MySQL on Linux is case-sensitive for table names by default; PostgreSQL folds unquoted identifiers to lowercase
- **Enum handling** — Both support ENUMs but with different syntax and behaviour
- **Tools:** AWS Schema Conversion Tool (SCT) + AWS Database Migration Service (DMS) can automate much of the migration. Expect manual fixes for stored procedures and triggers.

### PostgreSQL → MySQL

Less common, as teams rarely move away from PostgreSQL. The bigger challenge is losing features (JSONB, arrays, RLS, materialised views, extensions) that may require application rewrites.

### Same-Engine Migration (Version Upgrade)

For major version upgrades on RDS (e.g., MySQL 5.7 → 8.0, PostgreSQL 13 → 16):
- Test thoroughly in a staging environment
- Use the **RDS Blue/Green Deployment** feature for near-zero-downtime upgrades
- Check for deprecated functions and syntax before upgrading
- Review the AWS RDS upgrade documentation for each version — some versions require intermediate steps

---

## Summary

Both MySQL and PostgreSQL are excellent production databases with strong AWS RDS support. The "right" choice is rarely about one being objectively better — it's about fit for your specific workload, team experience, and future requirements.

**Default to PostgreSQL for new projects** unless you have a specific reason to use MySQL (existing CMS, team familiarity, specific performance requirements). PostgreSQL's feature richness gives you more room to grow without switching databases later.

**Stick with MySQL if** you're running established workloads, CMS-based applications, or teams deeply experienced in the MySQL ecosystem where re-training costs would outweigh technical benefits.

In both cases: enable encryption, use IAM authentication, keep instances in private subnets, enable Performance Insights, set up CloudWatch alarms, and never use your master database user for application connections.

---

*Last updated: 2026 | Based on AWS RDS MySQL 8.0 and PostgreSQL 16*

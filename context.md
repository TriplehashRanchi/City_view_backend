# Project Context

Maintenance rule: any schema or API decision change must be reflected in this file in the same change set.

## Project goal
- Build a simple restaurant booking and quotation backend.
- Keep the implementation direct: Express controllers, model files with SQL queries, and a small MySQL schema.
- Avoid extra layers, premature abstractions, and unused complexity.

## Finalized scope
- Admins manage products.
- Products are food items with `name`, `image_url`, `category_id`, `food_type`, `base_price`, `description`, and `status`.
- Admins create packages that contain products only.
- Admins manage product categories from a dedicated `product_categories` table.
- Packages have a manual `per_person_price`.
- Clients and events are stored separately.
- One quotation thread belongs to one event.
- Quotations are versioned.
- A quotation version can be created from scratch or from a package import.
- Imported package products can be added to or removed from before saving the version.
- Packages are not a separate quotation section; package import only populates the same flat quotation item list.
- Client-facing quotation output should show individual items by default.
- Only when a package is imported with no additions, removals, or custom items may the version retain package-display metadata.
- Quotation versions can include custom non-catalog items.
- Quotation pricing is manual:
  - `subtotal_amount = per_person_price * guest_count`
  - discount is then applied
  - `final_amount` is persisted
- Accepted quotation version marks the quotation accepted and the event confirmed.

## Explicit non-goals
- No services catalog in v1.
- No package services in v1.
- No booking table in v1.
- No tax, payment, or advance-payment tracking in v1.
- No separate pricing engine based on per-line totals in v1.
- No backend-stored package grouping sections; grouping is derived in the frontend from linked product category records.

## Data model decisions
- `clients` and `events` stay separate.
- `products` use a single `base_price` field.
- `products` reference `product_categories` through `category_id` instead of storing free-text categories.
- `product_categories` are admin-managed and used for dropdown consistency in the frontend.
- `packages` store manual `per_person_price`.
- `package_products` store package membership and `sort_order`.
- `quotations` track current status, latest version, and accepted version.
- `quotation_versions` are immutable snapshots.
- `quotation_versions` store `client_snapshot_json` and `event_snapshot_json` so PDFs do not drift when master data changes.
- `quotation_version_items` contain only `product` and `custom` items.
- Quotation version items are descriptive contents, not individually priced rows.
- `quotation_versions` may store source package metadata only to preserve unchanged-package display behavior.

## API decisions
- Keep simple CRUD-style endpoints for clients, events, products, and packages.
- Keep quotation endpoints limited to:
  - initialize quotation
  - list quotations by event
  - fetch quotation
  - download quotation PDF by quotation id, defaulting to latest version and optionally targeting a specific version
  - create version
  - clone version
  - fetch version
  - update version status
  - fetch PDF payload
- Version creation payload supports:
  - `sourcePackageId` optional
  - `productIds` array
  - `excludedProductIds` array
  - `customItems` array
  - `perPersonPrice`
  - `guestCount`
  - `discountType`
  - `discountValue`
  - `validUntil`
  - `notes`
  - `termsAndConditions`

## Pricing rules
- Product `base_price` is reference data only.
- Package `per_person_price` is entered manually.
- Quotation version `per_person_price` is entered manually.
- Quotation subtotal is always `per_person_price * guest_count`.
- Supported discount types:
  - `none`
  - `flat`
  - `percentage`
- `discount_amount` is computed and stored.
- `final_amount` cannot be negative.

## Status lifecycle
- Event status:
  - `enquiry`
  - `quotation_created`
  - `confirmed`
  - `cancelled`
- Quotation version and quotation status:
  - `draft`
  - `sent`
  - `accepted`
  - `rejected`

## Open questions
- Whether package membership should later support quantities per product.
- Whether quotation versions should later support per-line notes for imported products.
- Whether taxes should be introduced in a future version.

## Change log
- Initial v1 context created.
- Locked simplified v1 scope:
  - removed services
  - removed booking records
  - retained clients and events as separate records
  - retained quotation versioning
  - made quotation pricing manual
- Added explicit `excludedProductIds` support so package imports can be trimmed before saving a version.
- Locked quotation composition rule: package import populates the same flat item list; package label is retained only when the imported package is unchanged.

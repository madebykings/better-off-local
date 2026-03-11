# Better Off Local – Implementation Brief 02
# Profiles and Roles

## Objective

Create the identity layer for all platform users.

This links Supabase auth users to platform roles.

---

# Roles

Profiles must support these roles:

consumer  
retailer_user  
admin

---

# Table

profiles

Fields:

id (uuid)
auth_user_id
role
full_name
email
phone
avatar_url
is_active
created_at
updated_at

---

# Retailer Users

Create linking table:

retailer_users

Fields:

id
retailer_id
profile_id
access_role
is_active
created_at

Access roles:

owner  
manager  
staff

---

# Profile Creation Flow

When a new auth user signs up:

Create profile record.

Logic:
auth signup
→ create profile
→ assign role



Consumer app:

default role = consumer

---

# Admin Assignment

Admins will initially be created manually in the database.

Later an admin UI can be added.

---

# Portal Access Logic

Retailer Portal:

User must:

- be authenticated
- have role retailer_user

Admin Portal:

User must:

- be authenticated
- have role admin

---

# Flutter App Logic

Consumer app should:

- fetch profile on login
- cache minimal profile state
- expose profile via Riverpod provider

---

# Deliverables

Supabase:

profiles table  
retailer_users table

Next.js:

role guards

Flutter:

profile provider

---

# Acceptance Criteria

- profile created on signup
- role stored
- consumer app can read profile
- portals check roles correctly

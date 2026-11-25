# Portal administrator authentication

The standalone Veresiye app does not create a separate admin account. The admin screen uses the existing ProPOS `staff` record with role `admin`, active status, and its existing staff PIN. The Edge Function calls the existing `verify_staff_pin` RPC and validates business scope and role.

There is no first-public-user administrator bootstrap. Do not run or add the old `admin_profiles` setup for this integrated version.

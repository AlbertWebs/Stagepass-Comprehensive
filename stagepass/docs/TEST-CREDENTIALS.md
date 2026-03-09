# Test credentials for all roles

Use these after running `php artisan db:seed` in the Laravel API project.

**Web admin:** email + password `password`  
**Mobile app:** username + PIN `1234`

| Role        | Web login (email)           | Mobile login (username) | App experience        |
|-------------|-----------------------------|-------------------------|----------------------|
| **Admin**   | admin@stagepass.com         | admin                   | Full access          |
| **Director**| director@stagepass.com      | director                | Admin                |
| **Team Leader** | teamleader@stagepass.com | teamleader              | Leader dashboard     |
| **Crew**    | crew@stagepass.com          | crew                    | Assigned events only |
| **Accountant** | accountant@stagepass.com  | accountant              | Payments / finance   |
| **Logistics**  | logistics@stagepass.com   | logistics               | Equipment / transport|
| **Operations** | operations@stagepass.com | operations              | Event monitoring     |

To reseed (recreates roles and test users):

```bash
cd stagepass/backend/laravel-api
php artisan db:seed --force
```

Note: Seeder uses `firstOrCreate` by email, so existing users are updated with the correct role when you run the seeder again.

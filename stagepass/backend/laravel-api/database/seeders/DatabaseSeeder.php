<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Schema;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        Schema::disableForeignKeyConstraints();
        $this->call([
            AllowanceTypesTableSeeder::class,
            CacheTableSeeder::class,
            CacheLocksTableSeeder::class,
            ClientsTableSeeder::class,
            EquipmentTableSeeder::class,
            FailedJobsTableSeeder::class,
            HolidaysTableSeeder::class,
            JobBatchesTableSeeder::class,
            JobsTableSeeder::class,
            NotificationsTableSeeder::class,
            PasswordResetTokensTableSeeder::class,
            PermissionsTableSeeder::class,
            PersonalAccessTokensTableSeeder::class,
            RolesTableSeeder::class,
            SessionsTableSeeder::class,
            SettingsTableSeeder::class,
            UsersTableSeeder::class,
            AssignAdminRoleToDefaultAdminSeeder::class,
            VehiclesTableSeeder::class,
            PermissionRoleTableSeeder::class,
            ActivityLogsTableSeeder::class,
            AuditLogsTableSeeder::class,
            DailyOfficeCheckinsTableSeeder::class,
            EventsTableSeeder::class,
            RoleUserTableSeeder::class,
            TimeOffRequestsTableSeeder::class,
            CommunicationsTableSeeder::class,
            EventAllowancesTableSeeder::class,
            EventEquipmentTableSeeder::class,
            EventExpensesTableSeeder::class,
            EventMealsTableSeeder::class,
            EventNotesTableSeeder::class,
            EventPaymentsTableSeeder::class,
            EventUserTableSeeder::class,
            EventVehicleTableSeeder::class,
            ReminderLogsTableSeeder::class,
            TasksTableSeeder::class,
            TimeOffRequestAttachmentsTableSeeder::class,
            TaskCommentsTableSeeder::class,
            TaskUserTableSeeder::class,
        ]);
        Schema::enableForeignKeyConstraints();
    }
}

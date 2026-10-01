# Migrations held back for later

These run only when the feature is switched on. Run them in the order listed, after every numbered file in the parent folder has been run.

## job-board/ (set NEXT_PUBLIC_JOB_BOARD_ENABLED=true afterwards)
1. 0060_job_board_reset.sql
2. 0061_job_board.sql
3. 0062_job_board_rls_hardening.sql
4. 0063_job_applications.sql (the members.account_type part is already done by 0060_members_account_type.sql; the rest creates job_applications and the job banner columns)
5. 0064_banner_pay_description_optional.sql

## summit/ (set SUMMIT_ENABLED=true afterwards)
1. 0065_event_registrations.sql


## TODAY:
----------------
DONE - add csv logging of channel id and role id, and date of run.
DONE - add the cleanup code.
DONE -- bot checks if there are any logged channels and roles older than 3 days and deletes them.

## TODO:
---------------
- add to source control.
- add code that kicks already reminded people after a month without role.
- find out the exact message julian wants.
- test it out
- set it up somewhere and configure the cron to run it

## NOTES:
--------------
1. Bot runs every day at say 6pm central?

2. Bot cleans up any roles or channels it created that have been around for 3 days

3. Bot finds all users who joined a month ago or more, still don't have a role and have already been reminded, and kicks them. (edited)

4. Bot finds all users who joined at least 4 days ago, excluding anyone who was reminded already, assigns them a special temporary role called 'slow-roller', adds them to a temporary hidden private channel called 'slow-rollers' and @s the role in that channel, encouraging them to pick a role and participate. 
-- SQL Script to setup database

CREATE DATABASE synth_browse CHARACTER SET UTF8;
CREATE USER synth_user@localhost IDENTIFIED WITH mysql_native_password BY '123456789';
GRANT ALL PRIVILEGES ON synth_browse.* TO synth_user@localhost;
FLUSH PRIVILEGES;

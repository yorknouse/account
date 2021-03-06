SET sql_notes = 0; # Disbale warnings to prevent errors (see http://stackoverflow.com/questions/1650946/mysql-create-table-if-not-exists-error-1050)

CREATE TABLE IF NOT EXISTS `users` (
  `idusers` INT NOT NULL AUTO_INCREMENT,
  `fname` VARCHAR(45) NULL,
  `lname` VARCHAR(45) NULL,
  `email` VARCHAR(150) NOT NULL,
  `nick` VARCHAR(30) NULL,
  `activated` INT NOT NULL DEFAULT 1,
  `lastLogin` DATETIME NULL,
  PRIMARY KEY (`idusers`),
  UNIQUE INDEX `idusers_UNIQUE` (`idusers` ASC));
  
CREATE TABLE IF NOT EXISTS `googleauth` (
    `googid` VARCHAR(45) NOT NULL,
    `idusers` INT NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    PRIMARY KEY (`googid`),
    UNIQUE INDEX `googid_UNIQUE` (`googid` ASC),
    UNIQUE INDEX `email_UNIQUE` (`email` ASC));
  
CREATE TABLE IF NOT EXISTS `apiauth` (
  `idapiauth` INT NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(30) NOT NULL,
  `password` VARCHAR(32) NOT NULL,
  `urls` MEDIUMTEXT NULL,
  PRIMARY KEY (`idapiauth`),
  UNIQUE INDEX `username_UNIQUE` (`username` ASC));

CREATE TABLE IF NOT EXISTS `content` (
  `idcontent` INT NOT NULL AUTO_INCREMENT,
  `shortname` VARCHAR(32) NOT NULL,
  `description` VARCHAR(80) NULL,
  `logout` MEDIUMTEXT NULL,
  `login` MEDIUMTEXT NULL,
  PRIMARY KEY (`idcontent`),
  UNIQUE INDEX `shortname_UNIQUE` (`shortname` ASC));
  
CREATE TABLE IF NOT EXISTS `report` (
  `idreport` INT NOT NULL AUTO_INCREMENT,
  `type` VARCHAR(30) NOT NULL,
  `source` VARCHAR(200) NOT NULL,
  `item` VARCHAR(40) NOT NULL,
  `highlevel` INT NOT NULL,
  `details` MEDIUMTEXT NULL,
  `userid` INT NULL,
  `notes` MEDIUMTEXT NULL,
  `status` INT NULL DEFAULT 0,
  PRIMARY KEY (`idreport`));

CREATE TABLE IF NOT EXISTS `localauth` (
  `email` VARCHAR(150) NOT NULL,
  `password` VARCHAR(32) NOT NULL,
  `salt` VARCHAR(30) NOT NULL,
  `idusers` INT NOT NULL,
  `activationcode` VARCHAR(8) NOT NULL,
  PRIMARY KEY (`email`),
  UNIQUE INDEX `idusers_UNIQUE` (`idusers` ASC));
  
CREATE TABLE IF NOT EXISTS `fbauth` (
    `fbid` VARCHAR(45) NOT NULL,
    `idusers` INT NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    PRIMARY KEY (`fbid`),
    UNIQUE INDEX `fbid_UNIQUE` (`fbid` ASC),
    UNIQUE INDEX `email_UNIQUE` (`email` ASC));

CREATE TABLE IF NOT EXISTS `wpauth` (
    `wpid` VARCHAR(10) NOT NULL,
    `idusers` INT NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    PRIMARY KEY (`wpid`),
    UNIQUE INDEX `wpid_UNIQUE` (`wpid` ASC),
    UNIQUE INDEX `email_UNIQUE` (`email` ASC));
    
SET sql_notes = 1;
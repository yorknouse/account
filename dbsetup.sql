CREATE TABLE `nouseaccount`.`users` (
  `idusers` INT NOT NULL AUTO_INCREMENT,
  `fname` VARCHAR(45) NULL,
  `lname` VARCHAR(45) NULL,
  `email` VARCHAR(150) NOT NULL,
  `nick` VARCHAR(30) NULL,
  `activated` INT NOT NULL DEFAULT 1,
  `lastLogin` DATETIME NULL,
  PRIMARY KEY (`idusers`),
  UNIQUE INDEX `idusers_UNIQUE` (`idusers` ASC),
  UNIQUE INDEX `email_UNIQUE` (`email` ASC));
  
CREATE TABLE `nouseaccount`.`googleAuth` (
  `googid` VARCHAR(45) NOT NULL,
  `idusers` INT NOT NULL,
  PRIMARY KEY (`googid`),
  UNIQUE INDEX `googid_UNIQUE` (`googid` ASC));
  
CREATE TABLE `nouseaccount`.`apiauth` (
  `idapiauth` INT NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(30) NOT NULL,
  `password` VARCHAR(32) NOT NULL,
  `urls` MEDIUMTEXT NULL,
  PRIMARY KEY (`idapiauth`),
  UNIQUE INDEX `username_UNIQUE` (`username` ASC));
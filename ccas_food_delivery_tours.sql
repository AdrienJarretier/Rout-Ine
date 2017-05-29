-- phpMyAdmin SQL Dump
-- version 4.6.4
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: May 28, 2017 at 11:59 PM
-- Server version: 5.7.14
-- PHP Version: 5.6.25

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `ccas_food_delivery_tours`
--
CREATE DATABASE IF NOT EXISTS `ccas_food_delivery_tours` DEFAULT CHARACTER SET utf8 COLLATE utf8_general_ci;
USE `ccas_food_delivery_tours`;

-- --------------------------------------------------------

--
-- Table structure for table `address`
--

CREATE TABLE `address` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `label` varchar(255) NOT NULL,
  `town` varchar(255) NOT NULL,
  `lat` double NOT NULL,
  `lng` double NOT NULL,
  `special` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

INSERT INTO `address` (`label`, `town`, `lat`, `lng`, `special`) VALUES
('2 Avenue Colonel Teyssier', '81000 Albi', 43.9249975, 2.1499286, 'Centre Communal d''Action Sociale');

-- --------------------------------------------------------

--
-- Table structure for table `beneficiary`
--

CREATE TABLE `beneficiary` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `birthdate` date DEFAULT NULL,
  `address_additional` varchar(255) NOT NULL DEFAULT '',
  `address_id` bigint(20) UNSIGNED NOT NULL,
  `diet` varchar(255) NOT NULL DEFAULT '',
  `note` varchar(255) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `beneficiary_delivery_date`
--

CREATE TABLE `beneficiary_delivery_date` (
  `beneficiary_id` bigint(20) UNSIGNED NOT NULL,
  `date` date NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `beneficiary_phone`
--

CREATE TABLE `beneficiary_phone` (
  `beneficiary_id` bigint(20) UNSIGNED NOT NULL,
  `phone_number` char(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `tour`
--

CREATE TABLE `tour` (
  `num` tinyint(3) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `tour_assignment`
--

CREATE TABLE `tour_assignment` (
  `address_id` bigint(20) UNSIGNED NOT NULL,
  `tour_num` tinyint(3) UNSIGNED NOT NULL,
  `index_in_tour` smallint(5) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `address`
--
ALTER TABLE `address`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `label` (`label`,`town`);

--
-- Indexes for table `beneficiary`
--
ALTER TABLE `beneficiary`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_name_address` (`name`,`address_additional`,`address_id`),
  ADD KEY `address_id` (`address_id`);

--
-- Indexes for table `beneficiary_delivery_date`
--
ALTER TABLE `beneficiary_delivery_date`
  ADD UNIQUE KEY `beneficiary_id` (`beneficiary_id`,`date`);

--
-- Indexes for table `beneficiary_phone`
--
ALTER TABLE `beneficiary_phone`
  ADD UNIQUE KEY `unique_beneficiary_phone` (`beneficiary_id`,`phone_number`);

--
-- Indexes for table `tour`
--
ALTER TABLE `tour`
  ADD PRIMARY KEY (`num`);

--
-- Indexes for table `tour_assignment`
--
ALTER TABLE `tour_assignment`
  ADD UNIQUE KEY `tour_num` (`tour_num`,`index_in_tour`),
  ADD UNIQUE KEY `address_id` (`address_id`) USING BTREE;

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `address`
--
ALTER TABLE `address`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;
--
-- AUTO_INCREMENT for table `beneficiary`
--
ALTER TABLE `beneficiary`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;
--
-- Constraints for dumped tables
--

--
-- Constraints for table `beneficiary`
--
ALTER TABLE `beneficiary`
  ADD CONSTRAINT `fk_address_id` FOREIGN KEY (`address_id`) REFERENCES `address` (`id`);

--
-- Constraints for table `beneficiary_delivery_date`
--
ALTER TABLE `beneficiary_delivery_date`
  ADD CONSTRAINT `beneficiary_delivery_date_ibfk_1` FOREIGN KEY (`beneficiary_id`) REFERENCES `beneficiary` (`id`);

--
-- Constraints for table `beneficiary_phone`
--
ALTER TABLE `beneficiary_phone`
  ADD CONSTRAINT `fk_beneficiary_id` FOREIGN KEY (`beneficiary_id`) REFERENCES `beneficiary` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `tour_assignment`
--
ALTER TABLE `tour_assignment`
  ADD CONSTRAINT `tour_assignment_ibfk_1` FOREIGN KEY (`address_id`) REFERENCES `address` (`id`),
  ADD CONSTRAINT `tour_assignment_ibfk_2` FOREIGN KEY (`tour_num`) REFERENCES `tour` (`num`);

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

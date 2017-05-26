-- phpMyAdmin SQL Dump
-- version 4.5.4.1deb2ubuntu2
-- http://www.phpmyadmin.net
--
-- Host: localhost
-- Generation Time: May 26, 2017 at 04:11 PM
-- Server version: 5.7.17-0ubuntu0.16.04.1
-- PHP Version: 7.0.15-0ubuntu0.16.04.4

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `ccas_beneficiaries`
--
CREATE DATABASE IF NOT EXISTS `ccas_beneficiaries` DEFAULT CHARACTER SET utf8 COLLATE utf8_general_ci;
USE `ccas_beneficiaries`;

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

-- --------------------------------------------------------

--
-- Table structure for table `beneficiariesInTour`
--

CREATE TABLE `beneficiariesInTour` (
  `beneficiary_id` bigint(20) UNSIGNED NOT NULL,
  `tour_num` tinyint(3) UNSIGNED NOT NULL,
  `tour_date` date NOT NULL,
  `indexInTour` smallint(5) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

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
-- Table structure for table `beneficiary_phone`
--

CREATE TABLE `beneficiary_phone` (
  `beneficiary_id` bigint(20) UNSIGNED NOT NULL,
  `phone_number` char(14) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `tour`
--

CREATE TABLE `tour` (
  `num` tinyint(3) UNSIGNED NOT NULL,
  `date` date NOT NULL
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
-- Indexes for table `beneficiariesInTour`
--
ALTER TABLE `beneficiariesInTour`
  ADD KEY `beneficiary_id_index` (`beneficiary_id`) USING BTREE,
  ADD KEY `tour_keys_index` (`tour_num`,`tour_date`) USING BTREE;

--
-- Indexes for table `beneficiary`
--
ALTER TABLE `beneficiary`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_name_address` (`name`,`address_additional`,`address_id`),
  ADD KEY `address_id` (`address_id`);

--
-- Indexes for table `beneficiary_phone`
--
ALTER TABLE `beneficiary_phone`
  ADD UNIQUE KEY `unique_beneficiary_phone` (`beneficiary_id`,`phone_number`);

--
-- Indexes for table `tour`
--
ALTER TABLE `tour`
  ADD PRIMARY KEY (`num`,`date`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `address`
--
ALTER TABLE `address`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=589;
--
-- AUTO_INCREMENT for table `beneficiary`
--
ALTER TABLE `beneficiary`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=693;
--
-- Constraints for dumped tables
--

--
-- Constraints for table `beneficiariesInTour`
--
ALTER TABLE `beneficiariesInTour`
  ADD CONSTRAINT `beneficiariesInTour_ibfk_1` FOREIGN KEY (`tour_num`,`tour_date`) REFERENCES `tour` (`num`, `date`),
  ADD CONSTRAINT `beneficiariesInTour_ibfk_2` FOREIGN KEY (`beneficiary_id`) REFERENCES `beneficiary` (`id`);

--
-- Constraints for table `beneficiary`
--
ALTER TABLE `beneficiary`
  ADD CONSTRAINT `fk_address_id` FOREIGN KEY (`address_id`) REFERENCES `address` (`id`);

--
-- Constraints for table `beneficiary_phone`
--
ALTER TABLE `beneficiary_phone`
  ADD CONSTRAINT `fk_beneficiary_id` FOREIGN KEY (`beneficiary_id`) REFERENCES `beneficiary` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

-- phpMyAdmin SQL Dump
-- version 5.2.1deb1
-- https://www.phpmyadmin.net/
--
-- Vært: mysql11.gigahost.dk
-- Genereringstid: 15. 01 2026 kl. 12:37:17
-- Serverversion: 5.7.16
-- PHP-version: 8.2.26

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `maestromedia_dashboard`
--

-- --------------------------------------------------------

--
-- Struktur-dump for tabellen `project_with_sp`
--

CREATE TABLE `project_with_sp` (
  `id` int(11) NOT NULL,
  `project_name` varchar(255) NOT NULL,
  `project_id` int(50) NOT NULL,
  `mp_start_pp` datetime NOT NULL,
  `mp_end_pp` datetime NOT NULL,
  `subproject_name` varchar(255) NOT NULL,
  `subproject_id` int(50) NOT NULL,
  `sp_start_pp` datetime NOT NULL,
  `sp_end_pp` datetime NOT NULL,
  `sp_start_up` datetime NOT NULL,
  `sp_end_up` datetime NOT NULL,
  `sp_status` int(255) NOT NULL,
  `is_planning` tinyint(1) NOT NULL,
  `wh_out` int(50) DEFAULT NULL,
  `wh_in` int(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

--
-- Data dump for tabellen `project_with_sp`
--
(1923, 'Sylletester projektet', 1460, '2026-01-15 13:00:00', '2026-01-26 11:00:00', 'Sylletester projektet', 2875, '2026-01-15 13:00:00', '2026-01-26 11:00:00', '2026-01-16 07:00:00', '2026-01-24 07:00:00', 8, 1, NULL, NULL);

--
-- Begrænsninger for dumpede tabeller
--

--
-- Indeks for tabel `project_with_sp`
--
ALTER TABLE `project_with_sp`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `subproject_id` (`subproject_id`);

--
-- Brug ikke AUTO_INCREMENT for slettede tabeller
--

--
-- Tilføj AUTO_INCREMENT i tabel `project_with_sp`
--
ALTER TABLE `project_with_sp`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1926;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

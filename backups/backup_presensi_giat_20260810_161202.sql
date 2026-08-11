/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19-11.8.2-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: presensi_giat
-- ------------------------------------------------------
-- Server version	8.3.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*M!100616 SET @OLD_NOTE_VERBOSITY=@@NOTE_VERBOSITY, NOTE_VERBOSITY=0 */;

--
-- Table structure for table `admin_config`
--

DROP TABLE IF EXISTS `admin_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_config` (
  `id` int NOT NULL AUTO_INCREMENT,
  `admin_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'admin',
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'giat123',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `role` enum('SUPERADMIN','ADMIN') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ADMIN',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `last_login` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_config`
--

LOCK TABLES `admin_config` WRITE;
/*!40000 ALTER TABLE `admin_config` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `admin_config` VALUES
(1,'admin','giat123','2026-08-10 16:11:50','SUPERADMIN',1,'2026-08-10 16:11:50','2026-08-10 15:34:32'),
(2,'giat01','giat2026','2026-08-10 15:57:57','ADMIN',1,'2026-08-10 15:57:57','2026-08-10 15:50:52');
/*!40000 ALTER TABLE `admin_config` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `app_settings`
--

DROP TABLE IF EXISTS `app_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `app_settings` (
  `key` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `app_settings`
--

LOCK TABLES `app_settings` WRITE;
/*!40000 ALTER TABLE `app_settings` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `app_settings` VALUES
('attendance_cleanup_days','5','2026-06-30 00:36:20'),
('attendance_cleanup_enabled','false','2026-06-30 00:36:20'),
('barcode_content','KOPERASI GIAT','2026-05-27 13:57:56'),
('face_match_threshold','0.45','2026-08-10 14:52:42'),
('face_max_attempts','3','2026-08-10 14:52:42'),
('face_min_score','0.5','2026-08-10 14:52:42'),
('geofence_max_accuracy','100','2026-08-10 14:52:42'),
('geofence_max_radius','500','2026-08-10 14:52:42'),
('geofence_min_radius','50','2026-08-10 14:52:42'),
('geofence_require_gps','true','2026-08-10 14:52:42'),
('geofence_require_same_checkout','false','2026-08-10 14:52:42'),
('late_threshold_minutes','5','2026-06-08 10:39:21'),
('photo_retention_days','30','2026-05-27 14:34:18');
/*!40000 ALTER TABLE `app_settings` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `attendance`
--

DROP TABLE IF EXISTS `attendance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `attendance` (
  `id` int NOT NULL AUTO_INCREMENT,
  `timestamp` datetime DEFAULT CURRENT_TIMESTAMP,
  `date` date NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `location` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `shift` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `time_in` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `time_out` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('Tepat Waktu','Terlambat') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Tepat Waktu',
  `note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `photo_cdn_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gps_latitude` decimal(10,8) DEFAULT NULL,
  `gps_longitude` decimal(11,8) DEFAULT NULL,
  `check_in_photo_file_id` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `check_in_photo_url` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `check_in_latitude` decimal(10,7) DEFAULT NULL,
  `check_in_longitude` decimal(10,7) DEFAULT NULL,
  `check_out_photo_file_id` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `check_out_photo_url` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `check_out_latitude` decimal(10,7) DEFAULT NULL,
  `check_out_longitude` decimal(10,7) DEFAULT NULL,
  `check_in_location_id` int DEFAULT NULL,
  `check_in_accuracy` decimal(10,2) DEFAULT NULL,
  `check_in_distance` decimal(10,2) DEFAULT NULL,
  `check_out_location_id` int DEFAULT NULL,
  `check_out_accuracy` decimal(10,2) DEFAULT NULL,
  `check_out_distance` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_date_name` (`date`,`name`)
) ENGINE=InnoDB AUTO_INCREMENT=70 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance`
--

LOCK TABLES `attendance` WRITE;
/*!40000 ALTER TABLE `attendance` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `attendance` VALUES
(1,'2026-06-09 10:11:04','2026-06-09','ANDI AHMAD NURMADANI','RUANG 1','Normal','10.10','10.11','Terlambat','macet',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),
(2,'2026-06-10 14:30:22','2026-06-10','ANDI AHMAD NURMADANI','RUANG 1','Normal','14.30','14.30','Terlambat','Jdieid',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),
(3,'2026-06-11 18:37:18','2026-06-11','ANDI AHMAD NURMADANI','RUANG 1','Normal','18.37','18.37','Terlambat','fdf',NULL,NULL,NULL,NULL,NULL,-6.9222200,107.6070000,NULL,NULL,-6.9222200,107.6070000,NULL,NULL,NULL,NULL,NULL,NULL),
(4,'2026-06-13 07:24:30','2026-06-13','ANDI AHMAD NURMADANI','RUANG 1','Normal','07.24','07.24','Tepat Waktu','',NULL,NULL,NULL,NULL,NULL,-6.9731560,107.6322185,NULL,NULL,-6.9731560,107.6322185,NULL,NULL,NULL,NULL,NULL,NULL),
(5,'2026-06-30 07:38:42','2026-06-30','MAULANA FEBRIAN','GIAT MART','Normal','07.38','','Tepat Waktu','',NULL,NULL,NULL,'d49c458fde7f5b5e','https://api-cdn.kroombox.com/api/bridge/view/d49c458fde7f5b5e',-6.9732646,107.6320454,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),
(6,'2026-06-30 11:06:37','2026-06-30','FAHMI','KANTOR GIAT','Normal','11.06','','Terlambat','Terlambar',NULL,NULL,NULL,'263d3d3028dc511f','https://api-cdn.kroombox.com/api/bridge/view/263d3d3028dc511f',-6.9716134,107.6323342,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),
(7,'2026-07-23 20:01:30','2026-07-23','MAULANA FEBRIAN','GIAT MART','Shift Malam','20.01','','Tepat Waktu','',NULL,NULL,NULL,'c32ac9b3a87dfcd7','https://api-cdn.kroombox.com/api/bridge/view/c32ac9b3a87dfcd7',-6.9731460,107.6326590,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),
(8,'2026-07-28 14:18:51','2026-07-28','FAHMI','GIAT MART','Normal','14.18','17.04','Terlambat','macet',NULL,NULL,NULL,'be328ec88afa57aa','https://api-cdn.kroombox.com/api/bridge/view/be328ec88afa57aa',-6.9716318,107.6320752,'86a14793183dd04c','https://api-cdn.kroombox.com/api/bridge/view/86a14793183dd04c',-6.9714158,107.6323670,NULL,NULL,NULL,NULL,NULL,NULL),
(9,'2026-07-28 14:34:51','2026-07-28','ARIE ZAKARIA','GIAT MART','Shift Siang','14.34','17.03','Terlambat','Tes aplikasi',NULL,NULL,NULL,'45978eb8375dac46','https://api-cdn.kroombox.com/api/bridge/view/45978eb8375dac46',-6.9715801,107.6322619,'9bb1ac744b32c274','https://api-cdn.kroombox.com/api/bridge/view/9bb1ac744b32c274',-6.9715659,107.6324468,NULL,NULL,NULL,NULL,NULL,NULL),
(10,'2026-07-28 14:37:23','2026-07-28','DEVY I','KANTOR GIAT','Normal','14.37','17.02','Terlambat','Macet',NULL,NULL,NULL,'7fbab062cfbdf315','https://api-cdn.kroombox.com/api/bridge/view/7fbab062cfbdf315',-6.9715269,107.6324075,'7fc8b3fc9ac2e40c','https://api-cdn.kroombox.com/api/bridge/view/7fc8b3fc9ac2e40c',-6.9715269,107.6324075,NULL,NULL,NULL,NULL,NULL,NULL),
(11,'2026-07-28 14:42:04','2026-07-28','AMELIA R','GIAT MART','Shift Pagi','14.41','17.00','Terlambat','-',NULL,NULL,NULL,'f434b2976c015a91','https://api-cdn.kroombox.com/api/bridge/view/f434b2976c015a91',-6.9715706,107.6323061,'1b95152971bfcf29','https://api-cdn.kroombox.com/api/bridge/view/1b95152971bfcf29',-6.9715773,107.6322892,NULL,NULL,NULL,NULL,NULL,NULL),
(12,'2026-07-28 14:50:48','2026-07-28','YUSUF ANGGARA','TOKO FOTOCOPY','Normal','14.50','17.05','Terlambat','Percobaan absen ',NULL,NULL,NULL,'87973de1339976b2','https://api-cdn.kroombox.com/api/bridge/view/87973de1339976b2',-6.9715755,107.6323153,'e3dd75f89313d905','https://api-cdn.kroombox.com/api/bridge/view/e3dd75f89313d905',-6.9714533,107.6322747,NULL,NULL,NULL,NULL,NULL,NULL),
(13,'2026-07-28 14:52:49','2026-07-28','WAWAN','TOKO FOTOCOPY','Normal','14.52','17.02','Terlambat','-',NULL,NULL,NULL,'2458b330540792d4','https://api-cdn.kroombox.com/api/bridge/view/2458b330540792d4',-6.9716055,107.6323246,'c6484a6e1622763f','https://api-cdn.kroombox.com/api/bridge/view/c6484a6e1622763f',-6.9715289,107.6323641,NULL,NULL,NULL,NULL,NULL,NULL),
(14,'2026-07-28 15:45:44','2026-07-28','SEPTIANA M','ARTSHOP FIK','Shift Pagi','15.45','15.46','Terlambat','Coba absen',NULL,NULL,NULL,'b086059a07555df3','https://api-cdn.kroombox.com/api/bridge/view/b086059a07555df3',-6.9717678,107.6315980,'e3bc2dd908128ee6','https://api-cdn.kroombox.com/api/bridge/view/e3bc2dd908128ee6',-6.9716950,107.6316867,NULL,NULL,NULL,NULL,NULL,NULL),
(15,'2026-07-28 16:29:32','2026-07-28','JOJO S','GIAT EXPRESS','Normal','16.27','16.31','Terlambat','tes',NULL,NULL,NULL,'87b4ad6abdd0aaf4','https://api-cdn.kroombox.com/api/bridge/view/87b4ad6abdd0aaf4',-6.9715927,107.6322744,'50e27decc353299f','https://api-cdn.kroombox.com/api/bridge/view/50e27decc353299f',-6.9715442,107.6323239,NULL,NULL,NULL,NULL,NULL,NULL),
(16,'2026-07-28 17:02:31','2026-07-28','ANGGI P','KANTOR GIAT','Normal','17.02','17.02','Terlambat','trail',NULL,NULL,NULL,'9d5a28f2f678ff33','https://api-cdn.kroombox.com/api/bridge/view/9d5a28f2f678ff33',-6.9715229,107.6323701,'ef7543fc4be5bd0b','https://api-cdn.kroombox.com/api/bridge/view/ef7543fc4be5bd0b',-6.9715305,107.6323893,NULL,NULL,NULL,NULL,NULL,NULL),
(17,'2026-07-28 17:04:18','2026-07-28','IRMAN','KANTOR GIAT','Normal','17.04','17.04','Terlambat','Macet',NULL,NULL,NULL,'d70409fd87eb7bc5','https://api-cdn.kroombox.com/api/bridge/view/d70409fd87eb7bc5',-6.9714448,107.6323877,'79413ae18ec641ff','https://api-cdn.kroombox.com/api/bridge/view/79413ae18ec641ff',-6.9715289,107.6324073,NULL,NULL,NULL,NULL,NULL,NULL),
(18,'2026-07-29 06:27:37','2026-07-29','AMELIA R','GIAT MART','Shift Pagi','06.27','17.01','Tepat Waktu','',NULL,NULL,NULL,'3e3c0ef99da54b09','https://api-cdn.kroombox.com/api/bridge/view/3e3c0ef99da54b09',-6.9714017,107.6323676,'21b7853521ad53c2','https://api-cdn.kroombox.com/api/bridge/view/21b7853521ad53c2',-6.9715733,107.6322918,NULL,NULL,NULL,NULL,NULL,NULL),
(19,'2026-07-29 06:29:06','2026-07-29','FAHMI','ARTSHOP FIK','Shift Pagi','06.28','15.50','Tepat Waktu','',NULL,NULL,NULL,'71be7b237e7cd2c7','https://api-cdn.kroombox.com/api/bridge/view/71be7b237e7cd2c7',-6.9714348,107.6323189,'a0f64f0fb8adaaf9','https://api-cdn.kroombox.com/api/bridge/view/a0f64f0fb8adaaf9',-6.9715534,107.6324742,NULL,NULL,NULL,NULL,NULL,NULL),
(20,'2026-07-29 07:36:19','2026-07-29','YUSUF ANGGARA','TOKO FOTOCOPY','Normal','07.36','17.05','Tepat Waktu','',NULL,NULL,NULL,'bfbf6d83d67a4287','https://api-cdn.kroombox.com/api/bridge/view/bfbf6d83d67a4287',-6.9714248,107.6323863,'1789eeafa113b659','https://api-cdn.kroombox.com/api/bridge/view/1789eeafa113b659',-6.9714248,107.6325214,NULL,NULL,NULL,NULL,NULL,NULL),
(21,'2026-07-29 07:39:46','2026-07-29','JOJO S','GIAT EXPRESS','Normal','07.37','16.30','Tepat Waktu','',NULL,NULL,NULL,'0e2a3e831e159dd0','https://api-cdn.kroombox.com/api/bridge/view/0e2a3e831e159dd0',-6.9715615,107.6324114,'e3d584b190532daf','https://api-cdn.kroombox.com/api/bridge/view/e3d584b190532daf',-6.9715347,107.6323422,NULL,NULL,NULL,NULL,NULL,NULL),
(22,'2026-07-29 07:42:32','2026-07-29','WAWAN','TOKO FOTOCOPY','Normal','07.42','17.02','Tepat Waktu','',NULL,NULL,NULL,'f61855589c7bb68b','https://api-cdn.kroombox.com/api/bridge/view/f61855589c7bb68b',-6.9714960,107.6323290,'5e9cfe9f0b7aa923','https://api-cdn.kroombox.com/api/bridge/view/5e9cfe9f0b7aa923',-6.9715734,107.6324242,NULL,NULL,NULL,NULL,NULL,NULL),
(23,'2026-07-29 07:59:37','2026-07-29','ANGGI P','KANTOR GIAT','Normal','07.59','17.02','Tepat Waktu','',NULL,NULL,NULL,'f61955fe7e3d9f9c','https://api-cdn.kroombox.com/api/bridge/view/f61955fe7e3d9f9c',-6.9715668,107.6323240,'411c3fc0badc07d6','https://api-cdn.kroombox.com/api/bridge/view/411c3fc0badc07d6',-6.9715612,107.6324024,NULL,NULL,NULL,NULL,NULL,NULL),
(24,'2026-07-29 08:15:51','2026-07-29','ARIE ZAKARIA','GIAT MART','Shift Siang','08.15','17.01','Tepat Waktu','',NULL,NULL,NULL,'29ed0c4ccb68d7f6','https://api-cdn.kroombox.com/api/bridge/view/29ed0c4ccb68d7f6',-6.9715077,107.6323351,'b2acd9a6d0ee6ef8','https://api-cdn.kroombox.com/api/bridge/view/b2acd9a6d0ee6ef8',-6.9715193,107.6323679,NULL,NULL,NULL,NULL,NULL,NULL),
(25,'2026-07-29 08:24:32','2026-07-29','DEVY I','KANTOR GIAT','Normal','08.24','17.03','Terlambat','anter anak sekolah ',NULL,NULL,NULL,'081b55e0fa641312','https://api-cdn.kroombox.com/api/bridge/view/081b55e0fa641312',-6.9715088,107.6323284,'51df1b759a8ddd93','https://api-cdn.kroombox.com/api/bridge/view/51df1b759a8ddd93',-6.9715544,107.6323946,NULL,NULL,NULL,NULL,NULL,NULL),
(26,'2026-07-29 08:40:51','2026-07-29','DANNY KURWENDI','KANTOR GIAT','Normal','08.40','16.37','Terlambat','.',NULL,NULL,NULL,'a6f686ad9b716375','https://api-cdn.kroombox.com/api/bridge/view/a6f686ad9b716375',-6.9715739,107.6323091,'ac166493f4ab69d4','https://api-cdn.kroombox.com/api/bridge/view/ac166493f4ab69d4',-6.9716079,107.6323496,NULL,NULL,NULL,NULL,NULL,NULL),
(27,'2026-07-29 09:00:04','2026-07-29','SEPTIANA M','ARTSHOP FIK','Shift Siang','08.59','17.03','Tepat Waktu','',NULL,NULL,NULL,'e1d5285c9c3ed929','https://api-cdn.kroombox.com/api/bridge/view/e1d5285c9c3ed929',-6.9716117,107.6317800,'9216b63293a76d09','https://api-cdn.kroombox.com/api/bridge/view/9216b63293a76d09',-6.9718123,107.6316092,NULL,NULL,NULL,NULL,NULL,NULL),
(28,'2026-07-29 09:31:49','2026-07-29','IRMAN','KANTOR GIAT','Normal','09.31','17.43','Terlambat','Macet',NULL,NULL,NULL,'a0fbd95b38b211fd','https://api-cdn.kroombox.com/api/bridge/view/a0fbd95b38b211fd',-6.9715928,107.6324748,'0c723bf5513fd202','https://api-cdn.kroombox.com/api/bridge/view/0c723bf5513fd202',-6.9715702,107.6323249,NULL,NULL,NULL,NULL,NULL,NULL),
(29,'2026-07-30 07:23:21','2026-07-30','WAWAN','TOKO FOTOCOPY','Normal','07.23','','Tepat Waktu','',NULL,NULL,NULL,'73e60c0e33eac4ea','https://api-cdn.kroombox.com/api/bridge/view/73e60c0e33eac4ea',-6.9715075,107.6322564,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),
(30,'2026-07-30 07:37:55','2026-07-30','YUSUF ANGGARA','TOKO FOTOCOPY','Normal','07.37','','Tepat Waktu','',NULL,NULL,NULL,'7b1c5c2592bfa35f','https://api-cdn.kroombox.com/api/bridge/view/7b1c5c2592bfa35f',-6.9713960,107.6323123,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),
(31,'2026-07-30 07:48:08','2026-07-30','FAHMI','ARTSHOP FIK','Shift Pagi','07.47','','Terlambat','aplikasi error',NULL,NULL,NULL,'1a8cbc2620374a05','https://api-cdn.kroombox.com/api/bridge/view/1a8cbc2620374a05',-6.9718520,107.6315790,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),
(32,'2026-07-30 08:05:59','2026-07-30','ANGGI P','KANTOR GIAT','Normal','08.05','17.12','Terlambat','agak macet',NULL,NULL,NULL,'e6a12baa972981b3','https://api-cdn.kroombox.com/api/bridge/view/e6a12baa972981b3',-6.9715714,107.6323365,'5a051a33bae15cdf','https://api-cdn.kroombox.com/api/bridge/view/5a051a33bae15cdf',-6.9715112,107.6323855,NULL,NULL,NULL,NULL,NULL,NULL),
(33,'2026-07-30 08:22:03','2026-07-30','DEVY I','KANTOR GIAT','Normal','08.21','17.13','Terlambat','Telat',NULL,NULL,NULL,'5c8355a4d99fb85a','https://api-cdn.kroombox.com/api/bridge/view/5c8355a4d99fb85a',-6.9722713,107.6349311,'b5584f0b9a719fff','https://api-cdn.kroombox.com/api/bridge/view/b5584f0b9a719fff',-6.9715269,107.6324075,NULL,NULL,NULL,NULL,NULL,NULL),
(34,'2026-07-30 08:22:26','2026-07-30','ARIE ZAKARIA','GIAT MART','Shift Siang','08.22','17.03','Tepat Waktu','',NULL,NULL,NULL,'49097559f5154479','https://api-cdn.kroombox.com/api/bridge/view/49097559f5154479',-6.9714609,107.6323150,'eb86ec7114e5f763','https://api-cdn.kroombox.com/api/bridge/view/eb86ec7114e5f763',-6.9715035,107.6323546,NULL,NULL,NULL,NULL,NULL,NULL),
(35,'2026-07-30 08:34:33','2026-07-30','AMELIA R','GIAT MART','Shift Pagi','08.34','17.01','Terlambat','aplikasi error',NULL,NULL,NULL,'1a5886a0e8c0112c','https://api-cdn.kroombox.com/api/bridge/view/1a5886a0e8c0112c',-6.9715741,107.6323050,'4a5f101bbb9b6c87','https://api-cdn.kroombox.com/api/bridge/view/4a5f101bbb9b6c87',-6.9715790,107.6322495,NULL,NULL,NULL,NULL,NULL,NULL),
(36,'2026-07-30 08:59:37','2026-07-30','SEPTIANA M','ARTSHOP FIK','Shift Siang','08.59','17.02','Tepat Waktu','',NULL,NULL,NULL,'861207b9199bdca1','https://api-cdn.kroombox.com/api/bridge/view/861207b9199bdca1',-6.9718064,107.6316449,'00e2d234fe2e7b23','https://api-cdn.kroombox.com/api/bridge/view/00e2d234fe2e7b23',-6.9718726,107.6315637,NULL,NULL,NULL,NULL,NULL,NULL),
(37,'2026-07-30 09:16:25','2026-07-30','IRMAN','KANTOR GIAT','Normal','09.16','18.57','Terlambat','Macet',NULL,NULL,NULL,'0bca2e41f5cc782b','https://api-cdn.kroombox.com/api/bridge/view/0bca2e41f5cc782b',-6.9713873,107.6322503,'f536f7df0b6c4e45','https://api-cdn.kroombox.com/api/bridge/view/f536f7df0b6c4e45',-6.9715953,107.6323204,NULL,NULL,NULL,NULL,NULL,NULL),
(38,'2026-07-30 09:26:51','2026-07-30','DANNY KURWENDI','KANTOR GIAT','Normal','09.26','16.52','Terlambat','Lupa absen',NULL,NULL,NULL,'e48a050e742b2b1b','https://api-cdn.kroombox.com/api/bridge/view/e48a050e742b2b1b',-6.9715489,107.6324344,'813076421715d41c','https://api-cdn.kroombox.com/api/bridge/view/813076421715d41c',-6.9716129,107.6323363,NULL,NULL,NULL,NULL,NULL,NULL),
(39,'2026-07-31 06:44:27','2026-07-31','AMELIA R','GIAT MART','Shift Pagi','06.44','17.01','Tepat Waktu','',NULL,NULL,NULL,'1471147be6c834f4','https://api-cdn.kroombox.com/api/bridge/view/1471147be6c834f4',-6.9715185,107.6323660,'47b3ef3cadd51d8d','https://api-cdn.kroombox.com/api/bridge/view/47b3ef3cadd51d8d',-6.9715822,107.6322879,NULL,NULL,NULL,NULL,NULL,NULL),
(40,'2026-07-31 06:59:41','2026-07-31','SEPTIANA M','ARTSHOP FIK','Shift Pagi','06.59','15.39','Tepat Waktu','',NULL,NULL,NULL,'059eefe604a03fde','https://api-cdn.kroombox.com/api/bridge/view/059eefe604a03fde',-6.9713847,107.6322963,'e2ae7115a3f454a9','https://api-cdn.kroombox.com/api/bridge/view/e2ae7115a3f454a9',-6.9717340,107.6316695,NULL,NULL,NULL,NULL,NULL,NULL),
(41,'2026-07-31 07:19:53','2026-07-31','WAWAN','TOKO FOTOCOPY','Normal','07.19','','Tepat Waktu','',NULL,NULL,NULL,'0981afeea99cae9d','https://api-cdn.kroombox.com/api/bridge/view/0981afeea99cae9d',-6.9714720,107.6323352,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),
(42,'2026-07-31 07:36:12','2026-07-31','YUSUF ANGGARA','TOKO FOTOCOPY','Normal','07.36','17.01','Tepat Waktu','',NULL,NULL,NULL,'a1f1ec21d2c2f579','https://api-cdn.kroombox.com/api/bridge/view/a1f1ec21d2c2f579',-6.9714738,107.6324290,'af4e10665915e714','https://api-cdn.kroombox.com/api/bridge/view/af4e10665915e714',-6.9715781,107.6323592,NULL,NULL,NULL,NULL,NULL,NULL),
(43,'2026-07-31 07:43:25','2026-07-31','JOJO S','GIAT EXPRESS','Normal','07.41','16.31','Tepat Waktu','',NULL,NULL,NULL,'dd3d0ff1fe2a3bab','https://api-cdn.kroombox.com/api/bridge/view/dd3d0ff1fe2a3bab',-6.9715406,107.6323428,'b17279f0696a6925','https://api-cdn.kroombox.com/api/bridge/view/b17279f0696a6925',-6.9715265,107.6323472,NULL,NULL,NULL,NULL,NULL,NULL),
(44,'2026-07-31 08:11:47','2026-07-31','ANGGI P','KANTOR GIAT','Normal','08.11','17.09','Terlambat','agak macet🙏',NULL,NULL,NULL,'2bf277e419ef710d','https://api-cdn.kroombox.com/api/bridge/view/2bf277e419ef710d',-6.9715838,107.6322820,'6b63f924c3c3a1ee','https://api-cdn.kroombox.com/api/bridge/view/6b63f924c3c3a1ee',-6.9715286,107.6323720,NULL,NULL,NULL,NULL,NULL,NULL),
(45,'2026-07-31 08:19:34','2026-07-31','DEVY I','KANTOR GIAT','Normal','08.19','17.21','Terlambat','Nganter anak sekolah ',NULL,NULL,NULL,'e8066c2b84273a7c','https://api-cdn.kroombox.com/api/bridge/view/e8066c2b84273a7c',-6.9722713,107.6349311,'01e90f858c1cb81b','https://api-cdn.kroombox.com/api/bridge/view/01e90f858c1cb81b',-6.9722713,107.6349311,NULL,NULL,NULL,NULL,NULL,NULL),
(46,'2026-07-31 08:23:16','2026-07-31','ARIE ZAKARIA','GIAT MART','Shift Siang','08.23','17.00','Tepat Waktu','',NULL,NULL,NULL,'0b08da3518c73350','https://api-cdn.kroombox.com/api/bridge/view/0b08da3518c73350',-6.9714524,107.6324274,'c5bbe045c597d597','https://api-cdn.kroombox.com/api/bridge/view/c5bbe045c597d597',-6.9717461,107.6322762,NULL,NULL,NULL,NULL,NULL,NULL),
(47,'2026-07-31 08:28:42','2026-07-31','FAHMI','ARTSHOP FIK','Shift Siang','08.28','17.03','Tepat Waktu','',NULL,NULL,NULL,'2273bdc2b5594008','https://api-cdn.kroombox.com/api/bridge/view/2273bdc2b5594008',-6.9714795,107.6324433,'b4045c85febce29b','https://api-cdn.kroombox.com/api/bridge/view/b4045c85febce29b',-6.9714056,107.6323598,NULL,NULL,NULL,NULL,NULL,NULL),
(48,'2026-07-31 08:51:42','2026-07-31','IRMAN','KANTOR GIAT','Normal','08.51','','Terlambat','Macet',NULL,NULL,NULL,'5c0b8684e43436fb','https://api-cdn.kroombox.com/api/bridge/view/5c0b8684e43436fb',-6.9715914,107.6322621,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),
(49,'2026-08-01 09:45:18','2026-08-01','ANGGI P','KANTOR GIAT','Normal','09.45','','Terlambat','trial absen di rumah',NULL,NULL,NULL,'476ab263e2c632e3','https://api-cdn.kroombox.com/api/bridge/view/476ab263e2c632e3',-7.0030812,107.5769217,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),
(50,'2026-08-03 06:32:07','2026-08-03','AMELIA R','GIAT MART','Shift Pagi','06.31','17.00','Tepat Waktu','',NULL,NULL,NULL,'7b952ae3b8735c50','https://api-cdn.kroombox.com/api/bridge/view/7b952ae3b8735c50',-6.9713979,107.6323440,'7d791f122abe1191','https://api-cdn.kroombox.com/api/bridge/view/7d791f122abe1191',-6.9715840,107.6322795,NULL,NULL,NULL,NULL,NULL,NULL),
(51,'2026-08-03 06:33:38','2026-08-03','FAHMI','ARTSHOP FIK','Shift Pagi','06.33','15.42','Tepat Waktu','',NULL,NULL,NULL,'1310e4e9a4711a5e','https://api-cdn.kroombox.com/api/bridge/view/1310e4e9a4711a5e',-6.9714995,107.6323637,'8002ef947a9cd919','https://api-cdn.kroombox.com/api/bridge/view/8002ef947a9cd919',-6.9716692,107.6316753,NULL,NULL,NULL,NULL,NULL,NULL),
(52,'2026-08-03 07:22:37','2026-08-03','WAWAN','TOKO FOTOCOPY','Normal','07.22','','Tepat Waktu','',NULL,NULL,NULL,'94ba96ed806b82df','https://api-cdn.kroombox.com/api/bridge/view/94ba96ed806b82df',-6.9715038,107.6323324,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),
(53,'2026-08-03 07:35:26','2026-08-03','YUSUF ANGGARA','TOKO FOTOCOPY','Normal','07.35','17.02','Tepat Waktu','',NULL,NULL,NULL,'7d1ada55437c9c08','https://api-cdn.kroombox.com/api/bridge/view/7d1ada55437c9c08',-6.9715637,107.6324074,'93bb9776948699f6','https://api-cdn.kroombox.com/api/bridge/view/93bb9776948699f6',-6.9715312,107.6324048,NULL,NULL,NULL,NULL,NULL,NULL),
(54,'2026-08-03 07:49:56','2026-08-03','JOJO S','GIAT EXPRESS','Normal','07.47','16.30','Tepat Waktu','',NULL,NULL,NULL,'9997b5bb43590c88','https://api-cdn.kroombox.com/api/bridge/view/9997b5bb43590c88',-6.9715458,107.6323064,'e706212dec176d91','https://api-cdn.kroombox.com/api/bridge/view/e706212dec176d91',-6.9714241,107.6323214,NULL,NULL,NULL,NULL,NULL,NULL),
(55,'2026-08-03 08:10:38','2026-08-03','DANNY KURWENDI','KANTOR GIAT','Normal','08.10','','Terlambat','.',NULL,NULL,NULL,'2ffa379ccf5b3f6e','https://api-cdn.kroombox.com/api/bridge/view/2ffa379ccf5b3f6e',-6.9503590,107.6617660,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),
(56,'2026-08-03 08:12:08','2026-08-03','ANGGI P','KANTOR GIAT','Normal','08.11','17.13','Terlambat','macet dikit rancamanyar ',NULL,NULL,NULL,'7e5970331e909f05','https://api-cdn.kroombox.com/api/bridge/view/7e5970331e909f05',-6.9715967,107.6322839,'5ac81ffb6bcb12fe','https://api-cdn.kroombox.com/api/bridge/view/5ac81ffb6bcb12fe',-6.9715444,107.6323711,NULL,NULL,NULL,NULL,NULL,NULL),
(57,'2026-08-03 08:19:37','2026-08-03','DEVY I','KANTOR GIAT','Normal','08.19','17.13','Terlambat','Telat',NULL,NULL,NULL,'86cf825aeed602d6','https://api-cdn.kroombox.com/api/bridge/view/86cf825aeed602d6',-6.9722713,107.6349311,'a7d3ce7970d471e3','https://api-cdn.kroombox.com/api/bridge/view/a7d3ce7970d471e3',-6.9715269,107.6324075,NULL,NULL,NULL,NULL,NULL,NULL),
(58,'2026-08-03 08:34:25','2026-08-03','ARIE ZAKARIA','GIAT MART','Shift Siang','08.34','17.01','Tepat Waktu','',NULL,NULL,NULL,'d07dad2f116d71d2','https://api-cdn.kroombox.com/api/bridge/view/d07dad2f116d71d2',-6.9715669,107.6324351,'3503555f8daff17b','https://api-cdn.kroombox.com/api/bridge/view/3503555f8daff17b',-6.9715819,107.6324524,NULL,NULL,NULL,NULL,NULL,NULL),
(59,'2026-08-03 08:55:21','2026-08-03','SEPTIANA M','ARTSHOP FIK','Shift Siang','08.55','','Tepat Waktu','',NULL,NULL,NULL,'feefd5651fa6b15e','https://api-cdn.kroombox.com/api/bridge/view/feefd5651fa6b15e',-6.9717399,107.6319864,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),
(60,'2026-08-03 08:55:27','2026-08-03','SEPTIANA M','ARTSHOP FIK','Shift Siang','08.55','17.01','Tepat Waktu','',NULL,NULL,NULL,'625b9d0b62abd1c6','https://api-cdn.kroombox.com/api/bridge/view/625b9d0b62abd1c6',-6.9717399,107.6319864,'96b1cad5295aa951','https://api-cdn.kroombox.com/api/bridge/view/96b1cad5295aa951',-6.9723750,107.6325900,NULL,NULL,NULL,NULL,NULL,NULL),
(61,'2026-08-04 06:28:40','2026-08-04','FAHMI','ARTSHOP FIK','Shift Pagi','06.28','','Tepat Waktu','',NULL,NULL,NULL,'45d6d95f9d22ff44','https://api-cdn.kroombox.com/api/bridge/view/45d6d95f9d22ff44',-6.9715663,107.6323443,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),
(62,'2026-08-04 06:50:02','2026-08-04','AMELIA R','GIAT MART','Shift Pagi','06.49','','Tepat Waktu','',NULL,NULL,NULL,'0d8963fdf6ac4824','https://api-cdn.kroombox.com/api/bridge/view/0d8963fdf6ac4824',-6.9714246,107.6323093,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),
(63,'2026-08-04 07:22:59','2026-08-04','WAWAN','TOKO FOTOCOPY','Normal','07.22','','Tepat Waktu','',NULL,NULL,NULL,'02b86f67f1242763','https://api-cdn.kroombox.com/api/bridge/view/02b86f67f1242763',-6.9715391,107.6323072,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),
(64,'2026-08-04 07:33:36','2026-08-04','YUSUF ANGGARA','TOKO FOTOCOPY','Normal','07.33','','Tepat Waktu','',NULL,NULL,NULL,'22fca31b9fc8dd48','https://api-cdn.kroombox.com/api/bridge/view/22fca31b9fc8dd48',-6.9715615,107.6324416,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),
(65,'2026-08-04 07:41:53','2026-08-04','ANGGI P','KANTOR GIAT','Normal','07.41','','Tepat Waktu','',NULL,NULL,NULL,'fdcabe9d6efbb14d','https://api-cdn.kroombox.com/api/bridge/view/fdcabe9d6efbb14d',-7.0031290,107.5768839,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),
(66,'2026-08-04 07:48:52','2026-08-04','JOJO S','GIAT EXPRESS','Normal','07.46','','Tepat Waktu','',NULL,NULL,NULL,'50ffa3f06e840575','https://api-cdn.kroombox.com/api/bridge/view/50ffa3f06e840575',-6.9715520,107.6324768,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),
(67,'2026-08-04 08:21:03','2026-08-04','DEVY I','KANTOR GIAT','Normal','08.20','','Terlambat','Terlambat',NULL,NULL,NULL,'2396a7638da4b66a','https://api-cdn.kroombox.com/api/bridge/view/2396a7638da4b66a',-6.9722232,107.6349613,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),
(68,'2026-08-04 08:32:59','2026-08-04','ARIE ZAKARIA','GIAT MART','Shift Siang','08.32','','Tepat Waktu','',NULL,NULL,NULL,'1837aad815b81ba5','https://api-cdn.kroombox.com/api/bridge/view/1837aad815b81ba5',-6.9712913,107.6322565,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),
(69,'2026-08-04 08:41:02','2026-08-04','SEPTIANA M','ARTSHOP FIK','Shift Siang','08.40','','Tepat Waktu','',NULL,NULL,NULL,'0acefd2db7fd59ab','https://api-cdn.kroombox.com/api/bridge/view/0acefd2db7fd59ab',-6.9717592,107.6317094,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `attendance` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `actor` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `module` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `target` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `old_value` text COLLATE utf8mb4_unicode_ci,
  `new_value` text COLLATE utf8mb4_unicode_ci,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
set autocommit=0;
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `employee_locations`
--

DROP TABLE IF EXISTS `employee_locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee_locations` (
  `employee_id` int NOT NULL,
  `location_id` int NOT NULL,
  `is_primary` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`employee_id`,`location_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employee_locations`
--

LOCK TABLES `employee_locations` WRITE;
/*!40000 ALTER TABLE `employee_locations` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `employee_locations` VALUES
(2,2,0),
(2,3,0),
(2,6,0),
(3,4,0),
(4,2,0),
(4,3,0),
(6,2,0),
(7,2,0),
(7,3,0),
(8,3,0),
(9,3,0),
(10,6,0),
(11,6,0),
(12,5,0),
(12,6,0),
(14,4,0),
(15,3,0);
/*!40000 ALTER TABLE `employee_locations` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `employees`
--

DROP TABLE IF EXISTS `employees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `employees` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('AKTIF','CUTI','NONAKTIF') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'AKTIF',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `qr_code_data` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `photo_cdn_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `qr_code` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `photo_file_id` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `photo_url` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `qr_file_id` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `qr_url` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `face_registered` tinyint(1) DEFAULT '0',
  `face_descriptor` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  UNIQUE KEY `qr_code` (`qr_code`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employees`
--

LOCK TABLES `employees` WRITE;
/*!40000 ALTER TABLE `employees` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `employees` VALUES
(1,'ANDI AHMAD NURMADANI','AKTIF','2026-06-09 03:09:26',NULL,NULL,'GIAT-EMP-2b2a699e-79b2-45a8-8632-727098d376ac','d5509c4eb495bbbb','https://api-cdn.kroombox.com/api/bridge/view/d5509c4eb495bbbb',NULL,NULL,1,'[-0.08085869997739792, 0.04602349797884623, 0.031703426813085876, -0.06709429745872815, -0.10686558485031128, 0.034129951149225235, -0.06853260099887848, -0.17733961840470633, 0.197595477104187, -0.13415527095397314, 0.3208189407984416, -0.03666493048270544, -0.1819151987632116, -0.09459999700387318, -0.046692450841267906, 0.14071093748013178, -0.15779123703638712, -0.1472387264172236, 0.046172858526309334, -0.01076072889069716, 0.049223395685354866, -0.07119910294810931, 0.02215322852134705, 0.023303916677832603, -0.15564470489819843, -0.33357874552408856, -0.11658676713705064, -0.09896469364563625, 0.06933025270700455, -0.06102611621220907, -0.07367393622795741, 0.04564639925956726, -0.1897887239853541, -0.033952340483665466, -0.0348666962236166, 0.0963819349805514, -0.013715638934324184, -0.05253656953573227, 0.1702318787574768, -0.03428021321694056, -0.19723722338676453, -0.0006982168803612391, -0.056959069023529686, 0.21784683068593344, 0.1534795860449473, 0.030213844031095505, 0.07647104809681575, -0.14255252480506897, 0.06541430080930392, -0.17034141222635904, 0.10029400885105132, 0.12810994436343512, 0.0830743337670962, 0.040433173378308616, -0.021953357383608815, -0.15058698256810507, -0.008834853147466978, 0.12603086729844412, -0.13863552113374075, 0.05876590684056282, 0.06584654003381729, -0.01733560177187125, 0.04682733304798603, -0.05513611311713854, 0.2517458548148473, 0.12396395703156789, -0.10903530816237132, -0.1058880885442098, 0.16296454270680746, -0.09365044782559076, -0.04815045620004336, 0.0398094238092502, -0.16612792511781058, -0.23468364775180817, -0.3087666928768158, 0.05080957089861234, 0.4217398265997569, 0.09617892404397328, -0.18815950055917105, 0.013268942013382912, -0.05318170910080274, -0.007402594822148482, 0.13491957634687424, 0.11336321383714676, -0.012718642751375834, -0.0033871972312529883, -0.09668977682789166, 0.01559576236953338, 0.2373302032550176, -0.06896596401929855, -0.027298341505229473, 0.2155695905288061, -0.0485138688236475, 0.05001633738478025, 0.029774580771724384, 0.14761102199554443, -0.03014629023770491, 0.08046327531337738, -0.06230470910668373, 0.029670308654507, 0.039005681251486145, -0.057266256461540856, 0.009349558424825467, 0.1341475968559583, -0.18174110352993011, 0.14169426262378693, -0.013188184161360065, 0.02314517367631197, 0.02044446875030796, -0.026336931623518467, -0.03264644555747509, -0.06746308257182439, 0.16004308561484018, -0.2680918872356415, 0.196309357881546, 0.1905957063039144, 0.05106158057848612, 0.19279703497886655, 0.053482195983330406, 0.09440565357605615, -0.0019832908486326537, -0.061553640911976494, -0.1865917493899663, -0.0031872576413055262, 0.019217798641572397, -0.03438192047178745, 0.0453893169760704, 0.06903584798177083]'),
(2,'MAULANA FEBRIAN','AKTIF','2026-06-30 00:37:05',NULL,NULL,'GIAT-EMP-c3509926-e5bb-4e4f-a0b9-1ae716a12c97','79903c3c6e4f3878','https://api-cdn.kroombox.com/api/bridge/view/79903c3c6e4f3878',NULL,NULL,1,'[-0.12796961764494577, 0.013836189173161983, 0.0719448799888293, -0.04669566576679548, -0.09801638623078664, -0.10126341382662456, -0.031574937825401626, -0.14341083665688834, 0.12063499043385188, -0.06807513783375423, 0.33083999156951904, -0.08115293333927791, -0.20940783619880676, -0.17025037109851837, -0.03437600595255693, 0.18681870897610983, -0.241318479180336, -0.06291338056325912, -0.01410518679767847, -0.0015437410523494084, 0.10376141965389252, -0.0008837791780630747, 0.08896564195553462, 0.03550008311867714, -0.07964637627204259, -0.4589038093884786, -0.10866146286328632, -0.09101946155230203, 0.04178222889701525, -0.03099317600329717, -0.06665863593419392, 0.06204800556103388, -0.229110116759936, -0.07950746764739354, -0.000036605323354403176, 0.05631155769030253, -0.0111144013547649, -0.05272513503829638, 0.15390204389890036, -0.05223197489976883, -0.19822847346464792, -0.04761910748978456, 0.02412485269208749, 0.19552905360857645, 0.15387379129727682, 0.09217328329881032, 0.05371348808209101, -0.0864340936144193, 0.04838848610719045, -0.14512773851553598, 0.05098276833693186, 0.11183741688728333, 0.09010658413171768, -0.037506215274333954, -0.007260739182432492, -0.12514698753754297, -0.04261612147092819, 0.12187707672516504, -0.15396806101004282, -0.0018605922038356464, 0.08650342623392741, -0.09262503931919734, -0.04561643054087957, -0.10078652203083038, 0.24717425306638083, 0.07166486233472824, -0.1239856630563736, -0.1010592555006345, 0.1515220602353414, -0.09150852014621098, 0.0006050465938945612, 0.0032113132377465567, -0.17701589067777, -0.2171611189842224, -0.2953391869862874, 0.02101565959552924, 0.3908710976441701, 0.04242762178182602, -0.18661061426003775, -0.005040033409992854, -0.06691113859415054, 0.024246066187818844, 0.14207548399766287, 0.11567618201176326, 0.012975901365280151, 0.035084606458743416, -0.1461293399333954, 0.03566554312904676, 0.13736426333586374, -0.1065398504336675, 0.0065677193536733585, 0.22428305447101593, -0.05218688274423281, 0.06833592305580775, 0.00582164665684104, -0.0015230293696125348, -0.0577619361380736, 0.09315276890993118, -0.0934667612115542, 0.05602577328681946, 0.05373776455720266, -0.017345571890473366, 0.006188461712251107, 0.07648355265458424, -0.08248801777760188, 0.05426329125960668, 0.00589626623938481, 0.01857881465305885, 0.037409753228227295, -0.07889862606922786, -0.089969369272391, -0.14469953378041586, 0.0848982905348142, -0.2027813841899236, 0.19099730253219604, 0.18212904036045072, 0.03283317573368549, 0.20463562508424124, 0.03706762194633484, 0.10972832888364792, -0.01947711904843648, -0.03859887272119522, -0.22476385533809665, 0.029854807381828625, 0.12230425079663594, -0.04741058126091957, 0.08483334382375081, -0.01880817549924056]'),
(3,'FAHMI','AKTIF','2026-06-30 04:04:08',NULL,NULL,'GIAT-EMP-2d9ea7ed-c5e2-4af6-b774-52d2cb5d4d5f','309d863a43412c4a','https://api-cdn.kroombox.com/api/bridge/view/309d863a43412c4a',NULL,NULL,1,'[-0.10587408766150476, 0.08436903481682141, 0.07985665773351987, -0.02091637936731179, -0.06693329413731892, -0.04161689678827921, -0.017222583914796512, -0.10389248033364612, 0.12110766768455504, -0.06309522688388824, 0.25792603691418964, -0.03979134280234575, -0.2132646789153417, -0.11118557304143906, -0.02709984065343936, 0.13281786193450293, -0.1436478247245153, -0.12454563627640408, -0.07193231085936229, -0.027290234342217445, 0.038747599348425865, 0.02676037388543288, 0.014814346951122085, 0.0027324018689493337, -0.08153100435932477, -0.3067507247130076, -0.07773782933751743, -0.10583412647247314, -0.014072567534943422, -0.06401979426542918, -0.03070960752665997, 0.06477582827210426, -0.2094786663850149, -0.08244586239258449, -0.011485834295550982, 0.06009373813867569, -0.030768897694845993, 0.0012165733302632968, 0.16496055821577707, -0.028099291026592255, -0.17545669277509054, -0.02055581798776984, 0.04054341713587443, 0.26074891289075214, 0.1592047462860743, 0.05551662420233091, -0.025473634401957195, -0.0672862579425176, 0.04033504302302996, -0.2118155707915624, 0.0542986827592055, 0.14654389520486197, 0.10246039430300397, 0.07349764679869016, 0.017971449842055637, -0.13102607925732931, 0.017180198182662327, 0.06971083829800288, -0.14266025026639303, 0.006636188675959905, 0.04742117381344239, -0.06510529232521851, -0.04245716457565626, -0.0798123503724734, 0.2816583812236786, 0.07800633336106937, -0.09483793377876282, -0.11060974250237147, 0.1430428003271421, -0.09663885335127512, -0.07210536301136017, 0.07435312618811925, -0.15574193994204202, -0.17205990354220072, -0.2821655174096425, 0.07285561536749204, 0.3896263142426809, 0.07611577833692233, -0.19930520157019296, 0.02771812987824281, -0.0902040023356676, -0.01455897946531574, 0.08841470132271449, 0.05693638573090235, -0.03375720356901487, 0.04329727465907733, -0.08744868636131287, 0.02055249425272147, 0.18571524322032928, -0.07158306489388148, -0.040041995545228325, 0.1905154089132945, -0.009430982482930023, 0.02913757103184859, 0.043738375728329025, -0.012599829584360124, 0.016949567943811417, 0.024625550334652264, -0.17127132415771484, 0.00446336017921567, 0.05672507733106613, -0.05618714168667793, -0.02585195501645406, 0.10265599687894184, -0.13447987536589304, 0.08568661365037163, 0.04452074381212393, -0.006258898259450992, 0.008830248067776362, -0.017384979408234358, -0.10449400544166564, -0.08637575432658195, 0.15454343954722086, -0.22613122562567392, 0.22637573381265003, 0.1474116419752439, 0.028049767017364505, 0.1276718551913897, 0.06389754762252171, 0.09707477937142056, -0.03537985123693943, -0.023798907175660133, -0.17317832012971243, -0.02858434741695722, 0.14203843971093497, -0.013117619479695955, 0.06479994611193736, 0.02982193604111671]'),
(4,'ARIE ZAKARIA','AKTIF','2026-07-28 07:22:41',NULL,NULL,'GIAT-EMP-b14ad6e9-e544-470e-8eda-c5097f6476e8','57058bd7316c6ed0','https://api-cdn.kroombox.com/api/bridge/view/57058bd7316c6ed0',NULL,NULL,1,'[-0.1264872228105863, 0.12654297053813934, 0.05257526164253553, -0.06567358101407687, -0.0859651118516922, -0.03557144167522589, 0.01852782318989436, -0.16441475848356882, 0.2131079783042272, -0.13570400575796762, 0.2650211453437805, -0.06799045825997989, -0.20717703302701315, -0.09709940354029338, -0.009272929901878038, 0.1417652666568756, -0.15771484871705374, -0.12342792997757594, -0.08364708473285039, -0.03761366909990708, 0.07179017116626103, -0.020914036159714065, 0.003355309347777317, 0.046413821478684746, -0.06564377248287201, -0.31688154737154645, -0.12594864269097647, -0.09479835381110507, 0.03626365680247545, -0.07172844931483269, -0.008253038239975771, 0.00622530747205019, -0.18851488331953684, -0.08745098610719045, -0.04647693534692129, 0.032982111598054566, -0.023185680620372295, -0.03708303424840173, 0.15651395420233408, -0.07900256166855495, -0.22934748729070029, -0.030500339965025585, 0.03172504839797815, 0.20828784505526224, 0.14809252818425497, 0.06172173470258713, -0.015851692607005436, -0.1284855529665947, 0.07089950268467267, -0.1481965035200119, 0.059468140825629234, 0.10279648751020432, 0.104528213540713, 0.025634493678808212, 0.03593475061158339, -0.16783652702967325, 0.003058026544749737, 0.08265047272046407, -0.1709317167599996, -0.022187545895576477, 0.09007183214028676, -0.10378382354974748, -0.06910826886693637, -0.07101813579599063, 0.2674770653247833, 0.13082554936408997, -0.09523752331733704, -0.1626295248667399, 0.18751339614391327, -0.12298879027366638, -0.041139171769221626, 0.08229836200674374, -0.12316228449344636, -0.14948929846286774, -0.3007970154285431, 0.035046727706988655, 0.44884326060612995, 0.0814059500892957, -0.17898068328698477, 0.007350026319424312, -0.1277573232849439, 0.02145548475285371, 0.08831069990992546, 0.08298250784476598, -0.07544480140010516, 0.018472858394185703, -0.11885760972897212, -0.0005680639296770096, 0.14620412637790045, -0.05483016620079676, -0.04351810738444328, 0.1845791786909103, -0.011312976479530334, 0.017906596573690575, 0.01779046840965748, 0.011984465022881826, -0.08229995736231406, 0.025283251733829577, -0.1277284398674965, -0.03483651950955391, 0.07900042831897736, -0.032809398447473846, -0.017493734136223793, 0.12485765169064204, -0.17807842791080475, 0.14169523119926453, 0.02815224657145639, -0.0015824589257438977, 0.008991812355816364, -0.015312407786647478, -0.06942844825486343, -0.05596036712328593, 0.15140625337759653, -0.2366467118263245, 0.17247939109802246, 0.1169159437219302, 0.021320161099235214, 0.1685771346092224, 0.0727863647043705, 0.12182802458604176, -0.0426861047744751, -0.0413204375654459, -0.21674105525016785, -0.013782842239985865, 0.11764652281999588, -0.03954235961039861, 0.11095836758613586, 0.033624066350360714]'),
(6,'AMELIA R','AKTIF','2026-07-28 07:22:58',NULL,NULL,'GIAT-EMP-cbea309a-2d28-4acb-a546-7e04d4b4bfc9','4f74a64e9207859d','https://api-cdn.kroombox.com/api/bridge/view/4f74a64e9207859d',NULL,NULL,1,'[-0.0647261490424474, 0.055865416303277016, 0.03217819705605507, -0.06588824341694514, -0.0609641382470727, -0.0628235749900341, -0.05860516428947449, -0.11950213213761648, 0.16682449728250504, -0.13068288130064806, 0.26414309442043304, -0.0680867371459802, -0.2314544369777044, -0.034945400121311344, -0.048407415548960366, 0.18762183437744775, -0.19095705449581143, -0.08362556373079617, -0.07328668640305598, -0.016141061671078205, 0.06166863193114599, -0.029596455007170636, 0.05757910696168741, 0.07967801640431087, -0.09523986279964448, -0.3204919099807739, -0.13185273855924606, -0.09856364876031876, -0.020170586183667183, -0.07365256423751514, -0.010375242990752062, 0.044683017767965794, -0.16975495715936026, -0.03564752886692683, -0.012854214757680891, 0.02754572033882141, -0.03261527263869842, -0.12922238806883493, 0.1998005509376526, -0.001514469583829244, -0.22769702474276224, -0.053543431063493095, 0.024972762912511826, 0.24606568117936453, 0.18140609562397003, 0.013828159620364508, 0.008475995622575283, -0.09889870136976242, 0.09531392777959506, -0.24761882424354553, 0.015485292921463648, 0.1211161861817042, 0.04171371584137281, 0.044096563632289566, 0.02206629483650128, -0.11235012362400693, 0.06056014448404312, 0.11490597824255626, -0.16339929898579916, -0.012809150852262974, 0.07715892295042674, -0.08364595224459966, -0.03381178000320991, -0.0941282572845618, 0.2544914036989212, 0.14933465669552484, -0.14648128549257913, -0.11020892858505248, 0.15829385817050934, -0.13605068624019623, -0.04346204362809658, 0.045854946598410606, -0.16672944525877634, -0.22919579346974692, -0.3058050473531087, 0.00192400844146808, 0.41489867369333905, 0.12696004658937454, -0.16111660997072855, 0.02456922844673197, -0.06010917015373707, 0.004154743005832036, 0.11228044082721074, 0.1602631794909636, -0.017122958476344746, 0.01803637420137723, -0.07944825415809949, 0.028807726067801315, 0.1969448377688726, -0.09096461286147436, -0.03333765920251608, 0.23741766810417175, -0.04044629943867525, 0.021136137346426647, 0.022959246610601745, 0.037625257236262165, -0.05976757034659386, 0.02087280371536811, -0.14847310880819956, 0.0486297607421875, 0.039669287856668234, -0.02366262550155322, -0.02174880603949229, 0.10180577387412389, -0.1268095870812734, 0.08963310718536377, 0.016446726862341166, -0.03097958117723465, 0.02547369649012883, -0.024612443909669917, -0.11621344834566116, -0.09518662157158056, 0.13872046023607254, -0.2066688934961955, 0.14912672837575278, 0.16244123876094818, 0.05974970028425256, 0.13313861191272736, 0.07565053800741832, 0.12093481918176016, -0.023852142815788582, -0.03512417587141196, -0.20656443138917288, -0.008378799383838972, 0.09344315777222316, 0.000375412404537201, 0.04459464177489281, -0.027843738285203777]'),
(7,'ANGGI P','AKTIF','2026-07-28 07:23:35',NULL,NULL,'GIAT-EMP-b7bfaf20-9f88-4902-b990-40dc5bcfecce','4cc9b0cbc7c62564','https://api-cdn.kroombox.com/api/bridge/view/4cc9b0cbc7c62564',NULL,NULL,1,'[-0.05060403080036243, 0.08350101858377457, 0.0589123989144961, -0.06999602417151134, -0.08954735348622005, -0.017502860787014168, -0.05875967939694723, -0.14381190141042074, 0.14654376109441122, -0.13965068012475967, 0.24490799009799957, -0.07332947353521983, -0.2245627194643021, -0.03273386570314566, -0.03813381803532442, 0.20606264472007751, -0.19731647272904715, -0.10942231863737106, -0.08781934529542923, 0.02091156148041288, 0.11045051862796149, 0.011908976050714651, 0.007843239776169261, 0.05769355967640877, -0.10368212560812631, -0.34613125522931415, -0.08441115667422612, -0.025607343142231304, -0.010159328890343508, -0.06074008345603943, -0.045713684211174645, 0.02798440245290597, -0.22288258373737335, -0.026765822743376095, -0.00023757324864466983, 0.05326576220492522, -0.03954638727009296, -0.12324276318152744, 0.15249943484862646, -0.03751492624481519, -0.28931445876757306, 0.011512425107260546, 0.03926924616098404, 0.17423295974731445, 0.16676011184851328, 0.03224047273397446, -0.020151959111293156, -0.10232042893767355, 0.08245023836692174, -0.2026200294494629, 0.02390131602684657, 0.09923668205738068, 0.042704202234745026, 0.0625155121088028, -0.019796259701251984, -0.14604018131891883, 0.026856073488791782, 0.12569734950860342, -0.1481996849179268, -0.02690213204671939, 0.0931122899055481, -0.14029329270124435, 0.01120385341346264, -0.08743876467148463, 0.221570094426473, 0.10432424396276474, -0.12016423046588898, -0.1684709539016088, 0.09575292468070984, -0.12528261790672937, -0.01951879682019353, 0.0981353595852852, -0.13107279439767203, -0.18712973594665527, -0.29005804657936096, -0.009318418490389982, 0.41876301169395447, 0.09430146465698878, -0.19156450033187863, -0.03364818900202712, -0.05441486835479736, 0.02890987570087115, 0.17118019858996072, 0.12483436117569606, 0.04582752784093221, -0.002316551593442758, -0.1146015947063764, 0.025663296071191628, 0.24228034416834512, -0.0672247198720773, -0.05179856593410174, 0.27353877822558087, -0.02294629594932, 0.034820632388194404, -0.007634536052743594, 0.04284590808674693, -0.062429994344711304, 0.04521031056841215, -0.09330557783444722, 0.024231614855428536, 0.028159889702995617, 0.02233614027500153, -0.02392828868081172, 0.13914744555950165, -0.09661026298999786, 0.1083820288379987, -0.0016812408963839214, 0.056691695004701614, 0.06523693228761356, -0.008870467233161131, -0.1110492671529452, -0.12267153958479564, 0.10709556192159651, -0.2227686047554016, 0.15337479611237845, 0.14673184355099997, 0.042822075386842094, 0.1009961540500323, 0.06191752851009369, 0.1059609850247701, -0.026874154185255367, -0.0490455354253451, -0.2544279297192891, 0.006713312429686387, 0.1420436898867289, -0.02906929701566696, 0.10870124399662018, -0.025074404353896775]'),
(8,'DEVY I','AKTIF','2026-07-28 07:23:46',NULL,NULL,'GIAT-EMP-0d57a56c-f4aa-44e4-a972-0eaab3953b0b','3e57c7b855cb2f59','https://api-cdn.kroombox.com/api/bridge/view/3e57c7b855cb2f59',NULL,NULL,1,'[-0.2061102290948232, 0.15779325862725577, 0.05147269616524378, -0.08422091230750084, -0.11033243437608084, -0.06028112707038721, 0.026889576887091, -0.1003009205063184, 0.19700116415818533, -0.10357912133137386, 0.26478374501069385, -0.10896553844213486, -0.27146345376968384, -0.06071322908004125, -0.03893544028202693, 0.2429106483856837, -0.20764227708180744, -0.13939555486043295, -0.09085118522246678, 0.023103168234229088, 0.09208200375239056, 0.01717298353711764, 0.01147575913152347, 0.05863752836982409, -0.050379494205117226, -0.3881274362405141, -0.08977873623371124, -0.096792533993721, 0.004641400650143623, -0.07609716430306435, 0.01695080070445935, 0.06426017793516318, -0.1703676829735438, -0.127729132771492, 0.005555887085696061, 0.11652696629365283, -0.018564002277950447, -0.04883384797722101, 0.15492011606693268, -0.09780264397462209, -0.3042822976907094, 0.007184515707194805, 0.1332315281033516, 0.26777052382628125, 0.1508770783742269, 0.09640304992596307, 0.022246787324547768, -0.14124532043933868, 0.04157126943270365, -0.22893663744131723, -0.04274762297670046, 0.11124331255753836, 0.0705470268925031, 0.02532184061904748, 0.018937110900878903, -0.20839199423789975, 0.050152767449617386, 0.08310572803020477, -0.26097943385442096, -0.02476366174717744, 0.1400735005736351, -0.10235542804002762, 0.02802738981942336, -0.07173485557238261, 0.26683027545611065, 0.05822334811091423, -0.15692525605360666, -0.11328068375587463, 0.1680734654267629, -0.17735191931327185, 0.004761433073629935, 0.07019276171922684, -0.12534706791241965, -0.23636030654112497, -0.34237847725550336, -0.02489219730099042, 0.4119860033194224, 0.10661980758110684, -0.08229800313711166, 0.0724467287460963, -0.0788746178150177, 0.003610452637076378, 0.05192296455303828, 0.15999606251716614, -0.015074887312948704, 0.005995792957643668, -0.1319998030861219, 0.00156002522756656, 0.18038655320803323, -0.06804797798395157, 0.039472226053476334, 0.20482609669367471, 0.01225747043887774, -0.004105264320969582, -0.025234814112385113, 0.0754504178961118, -0.12226143479347228, 0.018601244625945885, -0.14552980661392212, 0.05833652553459009, -0.08928159127632777, -0.06316052625576656, -0.016310251007477444, 0.07999253769715627, -0.15364202360312143, 0.09471429884433746, -0.0024592354893684387, -0.008899076531330744, -0.0988772933681806, -0.02640300306181113, -0.034772676415741444, -0.05482092499732971, 0.13462322702010474, -0.22448175152142844, 0.17692052324612936, 0.22978387276331583, 0.0018056194918851056, 0.18722087144851685, 0.12104870875676473, 0.10012359420458476, -0.008134140633046627, -0.037690055246154465, -0.23555509746074677, -0.03211590647697449, 0.08615375806887944, -0.08508622149626414, 0.11715847005446751, 0.041118441770474114]'),
(9,'DANNY KURWENDI','AKTIF','2026-07-28 07:24:53',NULL,NULL,'GIAT-EMP-21c56e1c-d887-41e0-9baa-238fe80cc772','58ce2be66dfca21a','https://api-cdn.kroombox.com/api/bridge/view/58ce2be66dfca21a',NULL,NULL,1,'[-0.06990179046988487, 0.11170586198568344, 0.10948924720287324, 0.0009117480367422104, -0.0013057795974115531, -0.09425752361615498, -0.010616930822531382, -0.1312836855649948, 0.14763422310352323, -0.07414385676383972, 0.23058883349100748, -0.05940269803007444, -0.16044184813896814, -0.1091008981068929, 0.028819494259854157, 0.17124147216478983, -0.10886271049578984, -0.15323481460412344, -0.059475952138503395, -0.07167284811536472, 0.018636797710011404, 0.024062066649397213, 0.012165773039062818, 0.029377751052379608, -0.05393178264300028, -0.3239056468009949, -0.09472041328748068, -0.09883767614761987, 0.046676723286509514, -0.06739705909664433, -0.07105127101143201, 0.08125190685192744, -0.18899528682231903, -0.10488827402393024, 0.01831119569639365, 0.10304702073335648, -0.03991953159372011, -0.017858433226744335, 0.18298101425170896, 0.03731873879830042, -0.13968835026025772, 0.04019932014246782, 0.0014288077751795452, 0.26788702110449475, 0.20001018544038135, 0.07785443961620331, 0.02061764243990183, -0.09837980816761652, 0.01687358474979798, -0.17971161752939224, 0.029927509526411693, 0.1517433226108551, 0.08565948406855266, 0.09515598167975745, 0.009379625630875427, -0.10698524365822476, 0.036752269292871155, -0.003694229448835055, -0.17358904083569843, 0.031518579771121345, 0.10359739263852435, -0.12007927397886912, -0.043971127520004906, -0.01905183680355549, 0.27048725883165997, 0.05093327661355337, -0.06339669475952785, -0.124111441274484, 0.12958758821090063, -0.12358769029378892, -0.09806592514117558, 0.04943989962339401, -0.11574961990118028, -0.12381425003210704, -0.2544679492712021, 0.08811927835146587, 0.4193037152290344, 0.09540043771266936, -0.20032431681950888, 0.0818166583776474, -0.12541827311118445, -0.04146888976295789, 0.08966299643119176, 0.05986296012997627, -0.028529938620825607, -0.010659309414525827, -0.10867398232221603, -0.006582597270607948, 0.18269268174966177, -0.04323472020526727, -0.017048263767113287, 0.1749846339225769, -0.03858130363126596, 0.069252319013079, 0.018374846627314884, 0.00173733818034331, -0.05231382635732492, 0.05411589859674374, -0.11206008866429328, -0.1034967303276062, 0.08050976196924846, -0.03806155485411485, 0.015799343585968018, 0.1180535852909088, -0.19536736607551575, 0.1497741142908732, -0.00628143393745025, 0.0023648602267106376, 0.056788052121798195, 0.048120830208063126, -0.08382851382096608, -0.08040344466765721, 0.14163928727308908, -0.21503854791323343, 0.19614911079406736, 0.19531306624412537, 0.0056293730934460955, 0.10102438429991405, 0.08065549284219742, 0.1353935201962789, -0.025285605962077774, -0.011579491974165045, -0.1852229436238607, -0.03692799992859363, 0.08168645451466243, 0.04446843701104323, 0.060916315764188766, 0.06262325619657834]'),
(10,'YUSUF ANGGARA','AKTIF','2026-07-28 07:25:10',NULL,NULL,'GIAT-EMP-f339a59e-7983-4dfc-ba74-4decaaf45300','2d8b9a5e9bff2f07','https://api-cdn.kroombox.com/api/bridge/view/2d8b9a5e9bff2f07',NULL,NULL,1,'[-0.14532544712225595, 0.1240713099638621, 0.042631860822439194, -0.0017347270622849464, -0.0718366727232933, -0.04181555565446615, -0.015620722435414793, -0.11164722094933192, 0.0923142209649086, -0.029379017651081085, 0.2376374950011571, -0.03445680191119512, -0.2349470853805542, -0.08497682710488637, -0.04125934715072314, 0.13226253042618433, -0.22948472201824188, -0.1245510180791219, -0.0967208482325077, -0.05319560691714287, 0.04512715122352043, 0.013483106469114622, 0.013435072731226684, 0.03080091377099355, -0.097554715971152, -0.296725074450175, -0.045408559342225395, -0.1256979008515676, 0.02481439895927906, -0.08473775039116542, 0.0008934295425812403, 0.04777360210816065, -0.22795931498209632, -0.05515007053812345, -0.01856720292319854, 0.017194373533129692, 0.017650481934348743, 0.004701333120465279, 0.17563394705454508, 0.0042354641482234, -0.15173324942588806, 0.011984224120775858, 0.02893859272201856, 0.27544210851192474, 0.18259795506795248, 0.0517385887602965, -0.004744706054528554, -0.06226455016682545, 0.05040632048621774, -0.2576058159271876, 0.020027408997217815, 0.17738615969816843, 0.10283135622739792, 0.0661659153799216, 0.00863722711801529, -0.164547860622406, -0.0039668505390485125, 0.042650093945364155, -0.1487355480591456, 0.06919052451848984, 0.06113005864123503, -0.06248777483900388, -0.05185561378796896, -0.08390397081772487, 0.24690340956052145, 0.07428817202647527, -0.11639867474635442, -0.11482228090365729, 0.15835264325141907, -0.11526831736167271, -0.0908924862742424, 0.05425661553939184, -0.11318749437729518, -0.18000436822573343, -0.3014017542203267, 0.06153742472330729, 0.3905224204063415, 0.12148275723059972, -0.2191022584835688, 0.02783800723652045, -0.133892223238945, -0.007888135189811388, 0.04521260720988115, 0.05867607065010816, -0.06911978870630264, 0.028714984344939392, -0.09071629494428636, 0.023482201310495537, 0.17020263026158014, -0.02482168252269427, -0.040584852918982506, 0.2351765880982081, -0.0025882755095760026, 0.00387418270111084, 0.03993293891350428, 0.02559951537599166, -0.0211137564231952, -0.01656314420203368, -0.13024348517258963, -0.0058994777500629425, 0.04823750009139379, -0.102113276720047, -0.010581293143332005, 0.10410984853903452, -0.15557521084944406, 0.10865894953409833, 0.004648428410291672, 0.000403180718421936, -0.018196134207149346, 0.02018305038412412, -0.09237071126699448, -0.033972286308805145, 0.15628371387720108, -0.25644216934839886, 0.256224458416303, 0.20298954844474792, 0.013721062491337458, 0.12903886288404465, 0.05973197023073832, 0.09576794008413952, -0.04180998976031939, 0.0024946782117088637, -0.14122562110424042, -0.0958739034831524, 0.0842476636171341, -0.025999131922920544, 0.032391106709837914, 0.04469708042840163]'),
(11,'WAWAN','AKTIF','2026-07-28 07:25:15',NULL,NULL,'GIAT-EMP-74e7dee4-32d2-45d6-84bf-6a88f7af2711','8cdff7417e6a9691','https://api-cdn.kroombox.com/api/bridge/view/8cdff7417e6a9691',NULL,NULL,1,'[-0.018856875598430634, 0.10806634773810704, 0.06086085240046183, 0.03595993403966228, 0.01046872263153394, -0.013607285295923552, -0.02541358768939972, -0.1135241265098254, 0.1125589186946551, -0.05985061669101318, 0.25547198454538983, -0.02236694035430749, -0.22764561573664344, -0.0742811697224776, 0.01032434900601705, 0.13810546199480692, -0.17427794138590494, -0.07523910949627559, -0.1599071448047956, -0.07796891778707504, -0.004028988614057501, 0.018431027652695775, 0.05160542701681455, -0.025279528150955837, -0.1335920219620069, -0.3086361289024353, -0.05759895841280619, -0.10840096573034924, 0.04144250353177389, -0.0916676769653956, -0.014326564657191437, 0.021658293281992275, -0.18242913484573364, -0.03801994336148103, -0.01826180952290694, 0.05086754138271014, -0.06615601355830829, -0.06450886900226276, 0.2293104181687037, 0.033984893932938576, -0.14325199027856192, 0.05583995456496874, -0.00041944098969300586, 0.2482417126496633, 0.23551014065742493, 0.0313301607966423, 0.028314537989596527, -0.0972881242632866, 0.07847845057646434, -0.25191909571488696, 0.0051375751694043474, 0.13313730557759604, 0.04673478131492933, 0.10302609950304031, 0.04039323267837366, -0.12443075825770696, 0.01155176137884458, 0.06724905284742515, -0.15034744640191397, 0.02508470043540001, 0.05281492012242476, -0.10863444705804189, -0.03858899573485056, -0.02323880357046922, 0.17155860364437103, 0.07798555741707484, -0.07229411602020264, -0.08673915763696034, 0.13977100948492685, -0.13690629601478577, -0.058711472898721695, 0.0530599532648921, -0.09881758441527684, -0.1803757647673289, -0.3305744131406148, 0.053966001917918525, 0.4077264567216237, 0.09347608809669812, -0.16363664964834848, 0.01034563717742761, -0.04804301758607229, -0.021480055215458076, 0.13923992216587067, 0.05184411102284988, -0.05048693468173345, -0.06885199372967084, -0.08009649068117142, 0.06849782044688861, 0.2173034151395162, -0.0621472696463267, -0.039552188167969383, 0.16141597429911295, -0.03388473888238271, 0.020093906670808792, 0.02522990604241689, 0.048307000348965325, -0.04440084286034107, 0.03811688038210074, -0.12122585872809093, 0.035925913602113724, 0.08476334561904271, -0.07993749218682449, 0.02483692268530528, 0.07431030025084813, -0.1484608600536982, 0.10425594945748648, 0.026329730947812397, -0.05145011919861039, 0.07038864245017369, -0.009936099716772636, -0.11667011181513467, -0.01315777562558651, 0.18797838191191352, -0.2537439664204915, 0.23696493605772653, 0.22423666218916577, -0.027241935953497887, 0.1077485258380572, 0.06976037224133809, 0.10842696577310562, -0.05739685272177061, 0.01773844100534916, -0.20082530876000723, -0.07524144587417443, 0.02323665718237559, 0.0633346705387036, 0.03288273637493452, 0.010457554832100868]'),
(12,'JOJO S','AKTIF','2026-07-28 07:25:27',NULL,NULL,'GIAT-EMP-de81eec4-c4bc-4ebd-aa6b-68abb0e3a91e','5e88498d35866433','https://api-cdn.kroombox.com/api/bridge/view/5e88498d35866433',NULL,NULL,1,'[-0.06187641123930613, 0.06019424150387446, 0.11304594079653424, -0.014654994942247868, -0.00684737383077542, -0.15108521779378256, 0.04194921130935351, -0.14327991753816605, 0.14485021928946176, -0.1063695748647054, 0.34268327554066974, -0.01755376687894265, -0.17463742196559906, -0.12696498384078345, 0.02827286471923192, 0.1847532192866007, -0.17612696687380472, -0.09181537230809528, -0.09077094992001852, -0.05559524645407995, 0.02667914059323569, -0.025793807581067085, 0.07547114665309589, 0.040060168132185936, -0.010586578398942947, -0.369193693002065, -0.15652440985043845, -0.1397110770146052, 0.1044970452785492, -0.059784560153881706, -0.036558510114749275, -0.005009514590104421, -0.14421396454175314, -0.08675334105889003, -0.009356319283445677, -0.04113663733005524, -0.039745393209159374, -0.081080445398887, 0.21751676499843595, 0.03849183147152265, -0.15860713521639505, 0.018938169659425817, -0.008332837062577406, 0.26687005162239075, 0.1512312044699987, 0.04794423914669702, 0.09867179145415624, -0.05684403330087662, 0.05232137317458788, -0.1438858062028885, 0.04051133617758751, 0.06439060717821121, 0.1913213183482488, 0.027653009941180542, 0.03454539428154627, -0.13265076031287512, 0.03820273901025454, 0.06774897376696269, -0.23268618683020273, 0.08135109643141429, 0.11232902854681016, -0.12122298528750736, -0.035235244780778885, 0.04235686423877875, 0.2707856297492981, 0.08342145631710689, -0.12227446585893632, -0.09890527526537578, 0.1447178473075231, -0.10729796936114629, -0.001894476357847452, 0.021431604710717995, -0.17721464733282724, -0.15062548716862997, -0.27320317427317303, 0.05754317777852217, 0.4035632212956746, 0.046196055908997856, -0.156482403477033, -0.00950372281173865, -0.14770030975341797, 0.01663550330946843, 0.06235601877172788, 0.09203133235375088, -0.07134866217772166, -0.03526171172658602, -0.15107020239035288, -0.001862301491200924, 0.11131863296031952, -0.07793000092109044, -0.03423962617913882, 0.1944907009601593, -0.05766903484861056, 0.01799573718259732, -0.030128565927346543, 0.0033507375046610832, -0.09627342224121094, 0.03318017224470774, -0.027519897868235905, -0.0013538265290359657, 0.015326262141267458, -0.06897969171404839, 0.0015200202663739522, 0.05599713698029518, -0.19112818439801535, 0.08564879993597667, -0.0207939309378465, -0.014854402902225653, 0.008506311724583307, 0.013706455628077189, -0.09129271159569424, -0.09407177567481996, 0.07448530072967212, -0.22207725048065183, 0.20027547578016916, 0.24443062643210092, 0.04629856596390406, 0.12094662338495256, 0.011191514941553274, 0.05029090369741122, -0.03511418712635835, -0.03109369209657113, -0.16446833809216818, -0.0048289404561122256, 0.04767358675599098, 0.0006617465987801552, 0.06400931999087334, 0.01006615759494404]'),
(14,'SEPTIANA M','AKTIF','2026-07-28 08:21:45',NULL,NULL,'GIAT-EMP-0cd3d0bf-721d-4992-8c9d-3b180dd7857d','d3434e50db53e9e5','https://api-cdn.kroombox.com/api/bridge/view/d3434e50db53e9e5',NULL,NULL,1,'[-0.06138547323644161, 0.12026799470186234, 0.07654108355442683, 0.01133639132604003, -0.04235764965415001, -0.11249552046259244, -0.06417947635054588, -0.14894189685583115, 0.103152501086394, -0.05183974280953407, 0.23110664884249368, -0.05505415300528208, -0.1875795771678289, -0.08805484076340993, -0.028999497493108112, 0.1918178548415502, -0.15902682145436606, -0.11720616618792216, -0.08833947405219078, -0.006922756787389517, 0.06672269354263942, -0.0013838776697715125, 0.03827457409352064, 0.03673701733350754, -0.05002798015872637, -0.31372129917144775, -0.10273454835017522, -0.053944764037926994, 0.06360664715369542, -0.05397179691741864, -0.073563352227211, 0.03468021936714649, -0.21697928508122763, -0.10583993916710216, 0.044991073509057365, 0.01840784214437008, -0.025790502627690632, -0.07022503639260928, 0.19190837442874908, -0.007978188494841257, -0.20092037320137024, 0.03738299508889517, 0.02222279676546653, 0.25675181051095325, 0.21162846684455872, 0.063164833933115, 0.029948644960920017, -0.12988804777463278, 0.07176481435696284, -0.17376486957073212, 0.05275283008813858, 0.14409667998552322, 0.1060523937145869, 0.04591342310110728, 0.005629534522692363, -0.11042256156603496, 0.05303764094909032, 0.10345716774463654, -0.19320878386497495, 0.01751188685496648, 0.1223880151907603, -0.08427135894695918, -0.02350049341718356, -0.040177930146455765, 0.2550269464651744, 0.07091470435261726, -0.10046096642812093, -0.13163884729146955, 0.14147938787937164, -0.11315567791461945, -0.03899376280605793, 0.024612671385208767, -0.1308977132042249, -0.17263837655385336, -0.3225391109784444, 0.025895890469352405, 0.4206841786702474, 0.106711042424043, -0.22994409501552585, 0.07095402975877126, -0.0771380215883255, 0.011182539475460848, 0.14499234159787497, 0.10269789646069208, -0.05664684250950813, 0.009955141693353651, -0.1071509396036466, -0.001975265642007192, 0.19896091520786283, -0.04363683486978213, -0.04690469987690449, 0.2140953590472539, -0.0034854446227351823, 0.00859328762938579, 0.04303529982765516, 0.002001805075754722, -0.048698073253035545, -0.006211203833421071, -0.14560495813687643, -0.04272546557088693, 0.03184184369941553, -0.006023886303106944, -0.0003007564228028059, 0.140324334303538, -0.13195065160592398, 0.09629373500744502, 0.011881883721798658, 0.02839793016513189, 0.023141986535241205, -0.0049798985322316485, -0.10206518818934758, -0.11448352287213008, 0.08832771827777226, -0.2055515746275584, 0.18760520219802856, 0.14656867583592734, 0.03991287139554819, 0.08770948151747386, 0.0809962513546149, 0.10610163460175195, -0.006739652094741662, -0.011934087301294008, -0.16804749766985574, -0.026103205047547817, 0.13756820062796274, 0.000570906326174736, 0.1213890959819158, 0.018813231649498142]'),
(15,'IRMAN','AKTIF','2026-07-28 09:03:15',NULL,NULL,'GIAT-EMP-47505be7-fc25-424b-b8e5-9f2a1612b3f4','ac6db3c7ebe59157','https://api-cdn.kroombox.com/api/bridge/view/ac6db3c7ebe59157',NULL,NULL,1,'[-0.08580360064903896, 0.051553212416668735, 0.12366412580013277, -0.013216514450808368, -0.08023344663282235, -0.06614088701705138, -0.023528209266563255, -0.10453512022892636, 0.1027515356739362, -0.08497827251752217, 0.3060990869998932, -0.003996521234512329, -0.19418718417485556, -0.1598431821912527, 0.02400328467289607, 0.1334064950545629, -0.1377578203876813, -0.1206186090906461, -0.10638098667065304, -0.05678629502654075, 0.04652184434235096, -0.026315549698968727, 0.02426174438248078, 0.035229215398430824, -0.10736515124638876, -0.366145392258962, -0.09406626348694164, -0.09901199241479236, 0.10415795942147572, -0.097347520912687, -0.08074304337302844, 0.01845077859858672, -0.1949627622961998, -0.0738108903169632, -0.005481616283456485, 0.08033949881792068, 0.02577005815692246, -0.08628806471824646, 0.132609652976195, -0.03672058321535587, -0.1939351757367452, 0.010937944054603577, 0.018815867913266025, 0.2066624959309896, 0.22021655241648355, 0.051738922794659935, 0.043470870703458786, -0.03526414434115092, 0.08851457635561626, -0.2226094901561737, 0.04074037137130896, 0.1095280945301056, 0.12082301701108616, 0.04330007405951619, 0.0604396698375543, -0.18880717953046164, 0.005834658940633138, 0.10067009429136912, -0.16913722455501556, -0.003430737182497978, 0.01875011312464873, -0.07608137900630633, -0.02948052684466044, -0.03722853337725004, 0.2374968578418096, 0.10357250273227692, -0.13018454362948736, -0.09912215669949848, 0.15601890037457147, -0.12415262311697006, 0.006116555693248908, 0.03845116247733434, -0.1545614798863729, -0.13624598582585654, -0.2873939375082652, 0.08862914144992828, 0.4323037068049113, 0.10991521924734116, -0.23763210574785867, 0.00629817849646012, -0.12473403910795848, 0.04296488935748736, 0.07624081025520961, 0.034748480965693794, -0.04970568418502808, -0.006841599941253662, -0.15311696380376816, 0.007857145431141058, 0.15067090342442194, -0.02709134916464488, 0.023715616048624117, 0.19441203773021695, -0.022837532684206963, 0.042508503111700215, 0.03539100786050161, 0.04209348435203234, -0.10037040089567502, 0.020300085345904034, -0.09617907057205836, 0.013394520928462349, 0.050448610757788025, -0.06631685048341751, 0.009305153818180164, 0.09634670118490855, -0.16370384395122528, 0.09762674942612648, 0.0027254618083437285, -0.0022708751882116, 0.024010245377818745, -0.014854374962548414, -0.07478220388293266, -0.06448208416501681, 0.10129242390394212, -0.2584742208321889, 0.2139649987220764, 0.21402521431446075, 0.019390502634147804, 0.16088727613290152, 0.0707140639424324, 0.0804089605808258, -0.02344681555405259, -0.0486733919630448, -0.1386189162731171, -0.04916907474398613, 0.04889907439549764, -0.07323166976372401, 0.02968691351513068, 0.007210342834393184]');
/*!40000 ALTER TABLE `employees` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `locations`
--

DROP TABLE IF EXISTS `locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `locations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `address` text COLLATE utf8mb4_unicode_ci,
  `place_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `radius_meter` int DEFAULT '100',
  `max_accuracy_meter` int DEFAULT '50',
  `is_active` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `locations`
--

LOCK TABLES `locations` WRITE;
/*!40000 ALTER TABLE `locations` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `locations` VALUES
(1,'RUANG 1','2026-06-09 03:09:32',NULL,NULL,NULL,NULL,100,50,1),
(2,'GIAT MART','2026-06-30 00:33:53','Jalan Sukapura, Lengkong, Dayeuhkolot, Indonesia',NULL,-6.9717610,107.6324553,80,50,1),
(3,'KANTOR GIAT','2026-06-30 00:33:59','Jalan Sukapura, Lengkong, Dayeuhkolot, Indonesia',NULL,-6.9715273,107.6322997,80,50,1),
(4,'ARTSHOP FIK','2026-07-28 07:26:53','Danau Galau, Lengkong, Dayeuhkolot, Indonesia',NULL,-6.9720021,107.6313034,100,50,1),
(5,'GIAT EXPRESS','2026-07-28 07:27:06','Jalan Belakang Monumen Telkom, Lengkong, Dayeuhkolot, Indonesia',NULL,-6.9728878,107.6331349,80,50,1),
(6,'TOKO FOTOCOPY','2026-07-28 07:27:14','Jalan Sukapura, Lengkong, Dayeuhkolot, Indonesia',NULL,-6.9715174,107.6323520,80,50,1);
/*!40000 ALTER TABLE `locations` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `shifts`
--

DROP TABLE IF EXISTS `shifts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `shifts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `start_time` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '08:00',
  `end_time` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '17:00',
  `is_overtime` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shifts`
--

LOCK TABLES `shifts` WRITE;
/*!40000 ALTER TABLE `shifts` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `shifts` VALUES
(1,'Normal','08:00','16:30',0,'2026-06-09 03:09:38'),
(2,'Shift Malam','20:00','21:00',1,'2026-07-23 12:48:23'),
(3,'Shift Pagi','07:00','15:30',0,'2026-07-28 07:27:43'),
(5,'Shift Siang','10:00','18:30',0,'2026-07-28 07:29:17');
/*!40000 ALTER TABLE `shifts` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `ticket_messages`
--

DROP TABLE IF EXISTS `ticket_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `ticket_messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ticket_id` int NOT NULL,
  `sender_type` enum('REPORTER','SUPERADMIN') COLLATE utf8mb4_unicode_ci NOT NULL,
  `sender_user_id` int DEFAULT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `attachment_file_id` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `attachment_url` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ticket_id` (`ticket_id`),
  KEY `sender_user_id` (`sender_user_id`),
  CONSTRAINT `ticket_messages_ibfk_1` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ticket_messages_ibfk_2` FOREIGN KEY (`sender_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ticket_messages`
--

LOCK TABLES `ticket_messages` WRITE;
/*!40000 ALTER TABLE `ticket_messages` DISABLE KEYS */;
set autocommit=0;
/*!40000 ALTER TABLE `ticket_messages` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `tickets`
--

DROP TABLE IF EXISTS `tickets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tickets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ticket_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `employee_id` int DEFAULT NULL,
  `reporter_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `priority` enum('LOW','MEDIUM','HIGH','CRITICAL') COLLATE utf8mb4_unicode_ci DEFAULT 'MEDIUM',
  `status` enum('NEW','IN_PROGRESS','WAITING_REPORTER','RESOLVED','DUPLICATE','REJECTED') COLLATE utf8mb4_unicode_ci DEFAULT 'NEW',
  `screenshot_file_id` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `screenshot_url` text COLLATE utf8mb4_unicode_ci,
  `browser` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `operating_system` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `device` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `page_url` text COLLATE utf8mb4_unicode_ci,
  `api_endpoint` text COLLATE utf8mb4_unicode_ci,
  `http_status` int DEFAULT NULL,
  `error_code` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `gps_accuracy` decimal(10,2) DEFAULT NULL,
  `location_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `assigned_to` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `resolved_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ticket_number` (`ticket_number`),
  KEY `employee_id` (`employee_id`),
  KEY `assigned_to` (`assigned_to`),
  CONSTRAINT `tickets_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL,
  CONSTRAINT `tickets_ibfk_2` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tickets`
--

LOCK TABLES `tickets` WRITE;
/*!40000 ALTER TABLE `tickets` DISABLE KEYS */;
set autocommit=0;
/*!40000 ALTER TABLE `tickets` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('SUPERADMIN','ADMIN') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ADMIN',
  `is_active` tinyint(1) DEFAULT '1',
  `last_login` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `users` VALUES
(1,'superadmin','$2b$10$RR6eNQRLBARWGyus1BwDCukeIN1CkKdncH5pXyrX7sLgLhGBMPC8G','SUPERADMIN',1,NULL,'2026-08-10 14:52:42','2026-08-10 14:52:42'),
(2,'admin','$2b$10$UxHg2p1oK2g.2qL.S1uSMe0QvZJiwWyFYkQr7xPTKccM3ClG/.uNK','ADMIN',1,NULL,'2026-08-10 14:52:42','2026-08-10 14:52:42');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
commit;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*M!100616 SET NOTE_VERBOSITY=@OLD_NOTE_VERBOSITY */;

-- Dump completed on 2026-08-10 23:12:02

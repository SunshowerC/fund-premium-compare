
CREATE TABLE fund_predict_tab  (
  `id` bigint(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `fund_name` varchar(50)  NOT NULL,
	`fund_code` varchar(50)  NOT NULL,
  `predict_date` DATE NOT NULL ,
  `predict_company` varchar(50) NOT NULL,
  `predict_increase` float(4) NOT NULL COMMENT '估算涨幅',
  `final_increase` float(4) NOT NULL COMMENT '最终涨幅',
  `predict_premium` float(4) NOT NULL COMMENT '估算溢价率',
  `final_premium` float(4) NOT NULL COMMENT '最终溢价率',
  `error` float(4) NOT NULL COMMENT '误差',
  `success` tinyint(1) NOT NULL COMMENT '是否预测成功; 成功1，失败0；',
	 PRIMARY KEY (`id`),
   UNIQUE KEY `uni_code_company_date` (`fund_code`, `predict_company`, `predict_date`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
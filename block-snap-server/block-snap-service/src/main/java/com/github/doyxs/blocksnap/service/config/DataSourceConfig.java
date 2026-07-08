package com.github.doyxs.blocksnap.service.config;

import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;

/**
 * service 模块数据源配置。
 *
 * 历史背景：此前这里同时配置了 service / system 两个数据源，意图是让 service 模块通过
 * 独立数据源访问 block_snap_system 库的 sys_user_mark。但实际写 sys_user_mark 走的是
 * service 数据源 + 跨库 SQL（block_snap_system.sys_user_mark），并不需要第二个数据源。
 * 因此这里简化为单数据源，删除了无用的 systemDataSource 及其配套 SqlSessionFactory。
 */
@Configuration
public class DataSourceConfig {

    @Bean("serviceDataSourceProperties")
    @ConfigurationProperties("spring.datasource.service")
    public DataSourceProperties serviceDataSourceProperties() {
        return new DataSourceProperties();
    }

    @Bean("serviceDataSource")
    public DataSource serviceDataSource(
            org.springframework.beans.factory.annotation.Qualifier("serviceDataSourceProperties")
                    DataSourceProperties properties) {
        return properties.initializeDataSourceBuilder().build();
    }
}

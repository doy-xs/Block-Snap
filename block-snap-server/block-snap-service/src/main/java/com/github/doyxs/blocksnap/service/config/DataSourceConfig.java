package com.github.doyxs.blocksnap.service.config;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;

@Configuration
public class DataSourceConfig {

    @Bean("serviceDataSourceProperties")
    @ConfigurationProperties("spring.datasource.service")
    public DataSourceProperties serviceDataSourceProperties() {
        return new DataSourceProperties();
    }

    @Bean("systemDataSourceProperties")
    @ConfigurationProperties("spring.datasource.system")
    public DataSourceProperties systemDataSourceProperties() {
        return new DataSourceProperties();
    }

    @Primary
    @Bean("serviceDataSource")
    public DataSource serviceDataSource(
            @Qualifier("serviceDataSourceProperties") DataSourceProperties properties) {
        return properties.initializeDataSourceBuilder().build();
    }

    @Bean("systemDataSource")
    public DataSource systemDataSource(
            @Qualifier("systemDataSourceProperties") DataSourceProperties properties) {
        return properties.initializeDataSourceBuilder().build();
    }
}

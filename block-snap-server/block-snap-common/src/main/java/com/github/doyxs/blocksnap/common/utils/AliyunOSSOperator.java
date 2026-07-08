package com.github.doyxs.blocksnap.common.utils;

import com.aliyun.oss.ClientBuilderConfiguration;
import com.aliyun.oss.OSS;
import com.aliyun.oss.OSSClientBuilder;
import com.aliyun.oss.common.auth.CredentialsProviderFactory;
import com.aliyun.oss.common.comm.SignVersion;
import com.aliyun.oss.model.PutObjectRequest;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;

@Slf4j
@Component
public class AliyunOSSOperator {

    private final AliyunOSSProperties aliyunOSSProperties;
    private volatile OSS ossClient;

    public AliyunOSSOperator(AliyunOSSProperties aliyunOSSProperties) {
        this.aliyunOSSProperties = aliyunOSSProperties;
    }

    @PostConstruct
    void initClient() {
        String accessKeyId = aliyunOSSProperties.getAccessKeyId();
        String accessKeySecret = aliyunOSSProperties.getAccessKeySecret();
        if (accessKeyId == null || accessKeyId.isBlank()
                || accessKeySecret == null || accessKeySecret.isBlank()) {
            log.warn("阿里云 OSS accessKeyId/accessKeySecret 为空，OSS 上传功能不可用。" +
                    "请在 application-system-local.yml 或环境变量中配置有效凭证。");
            return;
        }
        ClientBuilderConfiguration cfg = new ClientBuilderConfiguration();
        cfg.setSignatureVersion(SignVersion.V4);
        this.ossClient = OSSClientBuilder.create()
                .endpoint(aliyunOSSProperties.getEndpoint())
                .credentialsProvider(CredentialsProviderFactory.newDefaultCredentialProvider(
                        accessKeyId, accessKeySecret))
                .clientConfiguration(cfg)
                .region(aliyunOSSProperties.getRegion())
                .build();
        log.info("阿里云 OSSClient 已初始化：endpoint={}, bucket={}, region={}",
                aliyunOSSProperties.getEndpoint(), aliyunOSSProperties.getBucketName(),
                aliyunOSSProperties.getRegion());
    }

    @PreDestroy
void shutdownClient() {
        if (ossClient != null) {
            try {
                ossClient.shutdown();
            } catch (Exception e) {
                log.warn("关闭 OSSClient 时发生异常：{}", e.getMessage());
            }
        }
    }

    public String upload(byte[] content, String objectName) {
        if (ossClient == null) {
            throw new IllegalStateException("OSSClient 未初始化（凭证缺失或初始化失败），无法上传文件");
        }
        try {
            PutObjectRequest putObjectRequest = new PutObjectRequest(
                    aliyunOSSProperties.getBucketName(), objectName,
                    new ByteArrayInputStream(content));
            ossClient.putObject(putObjectRequest);
            return buildObjectUrl(aliyunOSSProperties.getBucketName(),
                    aliyunOSSProperties.getEndpoint(), objectName);
        } catch (Exception e) {
            log.error("OSS 上传失败：objectName={}, reason={}", objectName, e.getMessage());
            throw new RuntimeException("文件上传失败，请稍后重试", e);
        }
    }

    private static String buildObjectUrl(String bucketName, String endpoint, String objectName) {
        String host = endpoint.replaceFirst("^https?://", "");
        return "https://" + bucketName + "." + host + "/" + objectName;
    }
}

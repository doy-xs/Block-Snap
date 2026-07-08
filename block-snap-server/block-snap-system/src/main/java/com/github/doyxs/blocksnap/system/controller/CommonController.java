package com.github.doyxs.blocksnap.system.controller;

import com.github.doyxs.blocksnap.common.api.Result;
import com.github.doyxs.blocksnap.common.exception.ApiException;
import com.github.doyxs.blocksnap.common.utils.AliyunOSSOperator;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/sys-common")
public class CommonController {

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"
    );
    private static final long MAX_IMAGE_BYTES = 5L * 1024 * 1024;

    private final AliyunOSSOperator aliyunOSSOperator;

    public CommonController(AliyunOSSOperator aliyunOSSOperator) {
        this.aliyunOSSOperator = aliyunOSSOperator;
    }

    @PostMapping("/upload")
    public Result<String> upload(@RequestPart("image") MultipartFile image) throws IOException {
        if (image == null || image.isEmpty()) {
            throw new ApiException("请选择要上传的图片");
        }
        if (image.getSize() > MAX_IMAGE_BYTES) {
            throw new ApiException("图片大小不能超过 5MB");
        }

        String originalFilename = image.getOriginalFilename();
        if (originalFilename == null || originalFilename.isBlank()) {
            throw new ApiException("文件名不合法");
        }
        int dot = originalFilename.lastIndexOf('.');
        if (dot < 0 || dot == originalFilename.length() - 1) {
            throw new ApiException("文件缺少扩展名");
        }
        String ext = originalFilename.substring(dot).toLowerCase(Locale.ROOT);
        if (!ALLOWED_EXTENSIONS.contains(ext)) {
            throw new ApiException("仅支持 jpg/jpeg/png/gif/webp/bmp 格式");
        }

        String contentType = image.getContentType();
        if (contentType == null || !contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
            throw new ApiException("文件内容类型不是图片");
        }

        String objectName = UUID.randomUUID() + ext;
        String url = aliyunOSSOperator.upload(image.getBytes(), objectName);
        return Result.success(url);
    }
}

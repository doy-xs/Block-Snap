package com.github.doyxs.blocksnap.service.model.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ModDetailVO {

    private Integer id;

    private Integer snapshotId;

    private Integer modInfoId;

    private String name;

    private String sourcePlatform;

    private String version;

    private String latestVersion;

    private Integer isLatestVersion;

    private String modHash;

    private Integer loadTime;

    private String note;

    private Integer isDelete;

    private Integer favorited;

    private LocalDateTime addedTime;

    private LocalDateTime updateTime;
}

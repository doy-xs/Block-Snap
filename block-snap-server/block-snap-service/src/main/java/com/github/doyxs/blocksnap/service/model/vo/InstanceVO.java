package com.github.doyxs.blocksnap.service.model.vo;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InstanceVO {
    private Integer id;//instance
    private String name;//instance
    private Integer favorite;//sys_user_mark
    private String note;//sys_user_mark
    private String mcVersion;//snapshot
    private Integer isNewVersion;//snapshot
    private Integer loaderType;//snapshot
    private String loaderVersion;//snapshot
    private String javaVersion;//snapshot
    private Integer totalLoadMs;//snapshot
    private Integer updateCount;
    private Integer modCount;
    private Integer resourceCount;//暂未添加 default0
    private Integer shaderCount;//暂未添加 default0
    private String modpackName;//modpack_info
    private String modpackVersion;//modpack_info
    private Integer modpackPlatform;//modpack_info
    private LocalDateTime lastLaunch;//snapshot.snapshot_time
}

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
public class ModVo {
    private Integer id;//mod_snapshot.id
    private String name;//mod_info.name
    private String version;//mod_snapshot.version（当前版本）
    private Integer isNewVersion;//mod_info.version(最新) vs mod_snapshot.version(当前)：1 最新 2 非最新
    private Integer isDeleted;//mod_snapshot.is_deleted
    private Long loadTime;//mod_snapshot.load_time
    private Integer favorite;//sys_user_mark
    private String note;//sys_user_mark
    private LocalDateTime addedTime;//mod_snapshot.added_time
    private LocalDateTime updateTime;//mod_snapshot.update_time
}

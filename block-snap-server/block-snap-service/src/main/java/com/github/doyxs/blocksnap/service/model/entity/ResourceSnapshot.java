package com.github.doyxs.blocksnap.service.model.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ResourceSnapshot {
    private Integer id;
    
    private Integer snapshotId;
    
    private Integer resourceInfoId;
    
    private String version;
    
    private String resourceHash;
    
    private Integer packFormat;
    
    private Integer isDeleted;
    
    
    private LocalDateTime addedTime;
    
    private LocalDateTime updateTime;
    
    private LocalDateTime createTime;
}

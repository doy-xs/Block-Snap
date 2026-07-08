package com.github.doyxs.blocksnap.service.model.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ShaderSnapshot {
    private Integer id;
    
    private Integer snapshotId;
    
    private Integer shaderInfoId;
    
    private String version;
    
    private String shaderHash;
    
    private Integer loader;
    
    private Integer isDeleted;
    
    
    private LocalDateTime addedTime;
    
    private LocalDateTime updateTime;
    
    private LocalDateTime createTime;
}

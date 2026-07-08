package com.github.doyxs.blocksnap.service.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.github.doyxs.blocksnap.service.model.entity.ResourceSnapshot;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface ResourceSnapshotMapper extends BaseMapper<ResourceSnapshot> {
}

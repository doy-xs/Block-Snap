package com.github.doyxs.blocksnap.service.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.github.doyxs.blocksnap.service.model.entity.ModInfo;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface ModInfoMapper extends BaseMapper<ModInfo> {

    /**
     * 跨库部分更新 block_snap_system.sys_user_mark 的收藏/备注（模组，target_type=2）。
     * target_id = mod_snapshot.id
     */
    int updateModMark();

    /**
     * 跨库插入一条 block_snap_system.sys_user_mark 标记（模组）。
     */
    void insertModMark();
}

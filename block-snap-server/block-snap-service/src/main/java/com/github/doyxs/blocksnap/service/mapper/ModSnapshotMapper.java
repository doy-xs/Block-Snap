package com.github.doyxs.blocksnap.service.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.github.doyxs.blocksnap.service.model.entity.ModSnapshot;
import com.github.doyxs.blocksnap.service.model.vo.ModVo;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface ModSnapshotMapper extends BaseMapper<ModSnapshot> {

    /**
     * 查询某用户指定实例「最新快照」下的模组列表。
     * ModVo.id = mod_snapshot.id；favorite/note 的 target_id 亦为 mod_snapshot.id。
     */
    List<ModVo> selectListByInstanceId(@Param("userId") Long userId,
                                       @Param("instanceId") Integer instanceId);
}

package com.github.doyxs.blocksnap.service.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.github.doyxs.blocksnap.service.model.entity.ModSnapshot;
import com.github.doyxs.blocksnap.service.model.vo.ModDetailVO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface ModSnapshotMapper extends BaseMapper<ModSnapshot> {

    @Select("""
            SELECT
                ms.id,
                ms.snapshot_id,
                ms.mod_info_id,
                mi.name,
                mi.source_platform,
                ms.version,
                mi.latest_version,
                ms.is_latest_version,
                ms.mod_hash,
                ms.load_time,
                ms.note,
                ms.is_delete,
                ms.favorited,
                ms.added_time,
                ms.update_time
            FROM mod_snapshot ms
            INNER JOIN mod_info mi ON mi.id = ms.mod_info_id
            WHERE ms.snapshot_id = #{snapshotId}
              AND (#{includeDeleted} = 1 OR ms.is_delete = 0)
            ORDER BY mi.name
            """)
    List<ModDetailVO> selectDetailsBySnapshotId(@Param("snapshotId") Integer snapshotId,
                                                @Param("includeDeleted") boolean includeDeleted);
}

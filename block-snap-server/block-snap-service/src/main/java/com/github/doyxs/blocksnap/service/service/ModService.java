package com.github.doyxs.blocksnap.service.service;

import com.github.doyxs.blocksnap.service.model.dto.InstanceNoteDTO;
import com.github.doyxs.blocksnap.service.model.dto.ModFavoriteDTO;
import com.github.doyxs.blocksnap.service.model.dto.ModNoteDTO;
import com.github.doyxs.blocksnap.service.model.vo.ModVo;

import java.util.List;

public interface ModService {

    /** 查询某用户指定实例「最新快照」下的模组列表。 */
    List<ModVo> listByInstanceId(Long userId, Integer instanceId);
    
    void note(Long userId, ModNoteDTO modNoteDTO);
    
    void favorite(Long userId, ModFavoriteDTO modFavoriteDTO);
}

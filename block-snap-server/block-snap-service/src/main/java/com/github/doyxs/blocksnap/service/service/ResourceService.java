package com.github.doyxs.blocksnap.service.service;

import com.github.doyxs.blocksnap.service.model.dto.ResourceFavoriteDTO;
import com.github.doyxs.blocksnap.service.model.dto.ResourceNoteDTO;
import com.github.doyxs.blocksnap.service.model.vo.ResourceVO;

public interface ResourceService {
    ResourceVO listByInstanceId(Long userId, Integer instanceId);
    
    void favorite(Long userId, ResourceFavoriteDTO resourceFavoriteDTO);
    
    void note(Long userId, ResourceNoteDTO resourceNoteDTO);
    
}

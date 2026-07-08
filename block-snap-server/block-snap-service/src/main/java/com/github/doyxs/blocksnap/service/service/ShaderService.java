package com.github.doyxs.blocksnap.service.service;

import com.github.doyxs.blocksnap.service.model.dto.ShaderFavoriteDTO;
import com.github.doyxs.blocksnap.service.model.dto.ShaderNoteDTO;
import com.github.doyxs.blocksnap.service.model.vo.ShaderVO;

public interface ShaderService {
    ShaderVO listByInstanceId(Long userId, Integer instanceId);
    
    void favorite(Long userId, ShaderFavoriteDTO shaderFavoriteDTO);
    
    void note(Long userId, ShaderNoteDTO shaderNoteDTO);
    
}

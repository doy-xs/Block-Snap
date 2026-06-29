package com.github.doyxs.blocksnap.service.service;

import com.github.doyxs.blocksnap.service.model.dto.InstanceFavoriteDTO;
import com.github.doyxs.blocksnap.service.model.dto.InstanceNoteDTO;
import com.github.doyxs.blocksnap.service.model.vo.InstanceVO;
import org.springframework.stereotype.Service;

import java.util.List;
@Service
public interface InstanceService {

    List<InstanceVO> listByUserId(Long userId);
    void favorite(Long userId, InstanceFavoriteDTO instanceFavoriteDTO);
    void note(Long userId, InstanceNoteDTO instanceNoteDTO);
}

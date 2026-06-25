package com.github.doyxs.blocksnap.service.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.github.doyxs.blocksnap.common.constant.MarkConst;
import com.github.doyxs.blocksnap.common.enums.ResultCode;
import com.github.doyxs.blocksnap.common.exception.ApiException;
import com.github.doyxs.blocksnap.service.mapper.InstanceMapper;
import com.github.doyxs.blocksnap.service.model.dto.InstanceFavoriteDTO;
import com.github.doyxs.blocksnap.service.model.dto.InstanceNoteDTO;
import com.github.doyxs.blocksnap.service.model.entity.Instance;
import com.github.doyxs.blocksnap.service.model.vo.InstanceVO;
import com.github.doyxs.blocksnap.service.service.InstanceService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;

import java.util.Collections;
import java.util.List;

@Service
@RequiredArgsConstructor
public class InstanceServiceImpl implements InstanceService {
    private final InstanceMapper instanceMapper;
    
    @Override
    public List<InstanceVO> listByUserId(Long userId) {
        List<InstanceVO> list = instanceMapper.selectListByUserId(userId);
        return CollectionUtils.isEmpty(list) ? Collections.emptyList() : list;
    }
    
    @Override
    public void favorite(Long userId, InstanceFavoriteDTO instanceFavoriteDTO) {
        Integer favorite = instanceFavoriteDTO.getFavorite();
        if (favorite == null || !(favorite == 0 || favorite == 1)) throw new ApiException(ResultCode.FAILED);
        upsertInstanceMark(userId, instanceFavoriteDTO.getInstanceId(), favorite, null);
    }
    
    @Override
    public void note(Long userId, InstanceNoteDTO instanceNoteDTO) {
        upsertInstanceMark(userId, instanceNoteDTO.getInstanceId(), null, instanceNoteDTO.getNote());
    }
    
    private void upsertInstanceMark(Long userId, Integer instanceId, Integer favorite, String note) {
        if (!instanceMapper.exists(Wrappers.<Instance>lambdaQuery().eq(Instance::getId, instanceId).eq(Instance::getUserId, userId))) {
            throw new ApiException(ResultCode.FAILED);
        }
        int updated = instanceMapper.updateInstanceMark(userId, instanceId, MarkConst.TARGET_TYPE_INSTANCE, favorite, note);
        if (updated == 0) {
            instanceMapper.insertInstanceMark(userId, instanceId, MarkConst.TARGET_TYPE_INSTANCE, favorite, note);
        }
    }
}

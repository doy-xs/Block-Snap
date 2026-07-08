package com.github.doyxs.blocksnap.service.controller;

import com.github.doyxs.blocksnap.common.api.Result;
import com.github.doyxs.blocksnap.service.model.dto.ModFavoriteDTO;
import com.github.doyxs.blocksnap.service.model.dto.ModNoteDTO;
import com.github.doyxs.blocksnap.service.model.dto.ResourceFavoriteDTO;
import com.github.doyxs.blocksnap.service.model.dto.ResourceNoteDTO;
import com.github.doyxs.blocksnap.service.service.ModService;
import com.github.doyxs.blocksnap.service.service.ResourceService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/svc-resource")
@RequiredArgsConstructor
public class ResourceController {
    private final ResourceService resourceService;
    
    @GetMapping("/list")
    public Result<Object> list(@RequestHeader("X-User-Id") Long userId,
                               @RequestParam("instanceId") Integer instanceId) {
        return Result.success(resourceService.listByInstanceId(userId, instanceId));
    }
    @PutMapping("/favorite")
    public Result<String> favorite(@RequestHeader("X-User-Id") Long userId, @RequestBody ResourceFavoriteDTO resourceFavoriteDTO) {
        resourceService.favorite(userId,resourceFavoriteDTO);
        return Result.success("修改成功");
    }
    @PutMapping("/note")
    public Result<String> note(@RequestHeader("X-User-Id") Long userId, @RequestBody ResourceNoteDTO  resourceNoteDTO) {
        resourceService.note(userId, resourceNoteDTO);
        return Result.success("修改成功");
    }
}

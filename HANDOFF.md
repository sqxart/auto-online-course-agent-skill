# HANDOFF — 协作交接说明

本文说明仓库结构与协作方式。个人课程实例、凭据、登录态和运行记录只留在本地。

## 项目与阅读顺序

`auto-online-course-agent-skill` 使用 Runner 执行确定性循环，由 agent 处理测验、弹窗、验证码与异常。两者通过状态文件和 `pauseReason` 通信。

1. `README.md`：功能与入口。
2. `docs/architecture.md`：架构、凭据层和状态协议。
3. `SKILL.md`：双平台运行手册、安全规则与授权边界。
4. `knowledge/chaoxing.md`、`knowledge/icourse163.md`：平台结构、选择器和处理配方。
5. `docs/field-notes.md`：匿名技术笔记。
6. `platforms/`：Runner 实现；`docs/roadmap.md`：技术待办。

## 运行形态

- 中国大学MOOC Runner 支持自动发现视频/文档任务与自适应登录；测验按运行手册处理。
- 学习通 Runner 已有登录、假完成重播与暂停原因处理，但无头会话可能被平台切出；可见浏览器监督模式是可用路径。
- 两平台 Runner 默认无头；临时有头开关为 `CHAOXING_HEADED=1`、`MOOC_HEADED=1`。
- 锁速课接受平台速率，使用只读信标；字体映射按页随机，不依赖跨页映射。

## 协作规则

1. 保留真实播放、官方最高 2x、同账号单执行器和风控停止规则；操作以当前用户授权和 `SKILL.md` 为准。
2. 技术笔记记录可复用机制。修正旧结论时说明适用条件；个人运行证据不进入公开笔记。
3. 凭据经临时环境变量或忽略的 `credentials.local.json` 传递，不写入公开日志、状态或提交。新增运行产物先补 ignore。
4. 接口和页面事实可参考上游；本仓库 MIT，不复制 GPL 上游实现。参考克隆放在仓库外。
5. 完成可验证改动后提交，说明问题、改动与验证。发布和上游协作按用户授权执行。

## 本机运行

1. 在 `platforms/<平台目录>` 安装依赖（Playwright Core，使用系统浏览器）。
2. 按 `SKILL.md` 获取本次凭据：设置 `CHAOXING_PHONE/CHAOXING_PASSWORD` 或 `MOOC_PHONE/MOOC_PASSWORD`，也可使用忽略的本地凭据文件。
3. 用 `CHAOXING_PROFILE_DIR` 或 `MOOC_PROFILE_DIR` 指定独立 profile，再运行 `node runner.mjs --course <课程json>`；中国大学MOOC 也支持 `npm run login` 扫码。
4. 修改平台实现前读对应 knowledge 文件；异常记录先移除可识别实例信息，再归纳为技术笔记。

## 发布范围

公开树保留工具、占位模板和匿名技术结论；真实课程配置、签名链接、账号资料、运行证据与浏览器 profile 留在本地。
`course-study-v2/` 按白名单导出，不携带开发 Git 历史；仓库历史应单独检查和清理。

发布前检查运行产物与真实配置均被排除，Runner 要求显式 `--course`，公开文档中的平台实例参数、个人路径和身份值均已占位。保留通用选择器、配置字段与合成测试数据。

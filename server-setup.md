# 服务器初始化指南 (Ubuntu)

> **执行一次即可**，之后每次推送代码会自动部署。

## 第一步：安装 Docker

```bash
# 更新包列表
sudo apt-get update

# 安装必要依赖
sudo apt-get install -y ca-certificates curl gnupg

# 添加 Docker 官方 GPG 密钥
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# 添加 Docker 源
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装 Docker Engine + Compose Plugin
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 允许当前用户使用 Docker（免 sudo）
sudo usermod -aG docker $USER
newgrp docker

# 验证安装
docker --version
docker compose version
```

## 第二步：创建部署目录

```bash
sudo mkdir -p /opt/wechat-relay/data
sudo chown -R $USER:$USER /opt/wechat-relay
cd /opt/wechat-relay

# 初始化空数据库文件
echo '{"messages":[]}' > data/db.json
```

## 第三步：上传配置文件

将以下文件上传到 `/opt/wechat-relay/`：

```bash
# 在本机执行（替换 YOUR_SERVER_IP）
scp docker-compose.yml nginx.conf ubuntu@YOUR_SERVER_IP:/opt/wechat-relay/
```

或者直接在服务器上手动创建这两个文件（内容见项目根目录）。

## 第四步：配置 GitHub Secrets

在 GitHub 仓库 → **Settings** → **Secrets and variables** → **Actions** 中添加：

| Secret 名称 | 值 |
|---|---|
| `DOCKERHUB_USERNAME` | 你的 Docker Hub 用户名 |
| `DOCKERHUB_TOKEN` | Docker Hub → Account Settings → Security → New Access Token |
| `SERVER_HOST` | 服务器 IP 地址 |
| `SERVER_USER` | SSH 用户名（通常是 `ubuntu`）|
| `SERVER_SSH_KEY` | SSH 私钥内容（`cat ~/.ssh/id_rsa`）|
| `SERVER_PORT` | SSH 端口（默认 `22`）|

### 生成 SSH 密钥对（如果还没有）

```bash
# 在你的本机生成
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/deploy_key

# 将公钥添加到服务器
ssh-copy-id -i ~/.ssh/deploy_key.pub ubuntu@YOUR_SERVER_IP

# 将私钥内容（deploy_key 文件）填入 SERVER_SSH_KEY Secret
cat ~/.ssh/deploy_key
```

## 第五步：手动首次部署（测试）

```bash
cd /opt/wechat-relay

# 创建 .env 文件（替换为你的 Docker Hub 用户名）
echo "DOCKERHUB_USERNAME=your_dockerhub_username" > .env
echo "IMAGE_TAG=latest" >> .env

# 登录 Docker Hub（首次需要）
docker login

# 拉取并启动
docker compose pull
docker compose up -d

# 查看状态
docker compose ps
docker compose logs -f
```

## 验证部署

```bash
# 检查容器状态
docker compose ps

# 测试接口（在服务器上）
curl http://localhost:80/api/messages
curl http://localhost:80

# 查看日志
docker compose logs app --tail=50
docker compose logs nginx --tail=20
```

## 防火墙设置

```bash
# 开放 80 端口
sudo ufw allow 80/tcp
sudo ufw allow 22/tcp  # SSH（确保已开放，否则会断连）
sudo ufw enable
sudo ufw status
```

## 后续操作

- **自动部署**：推送代码到 `main` 分支即自动触发，无需手动操作
- **查看部署历史**：GitHub 仓库 → Actions Tab
- **数据备份**：定期备份 `/opt/wechat-relay/data/db.json`
  ```bash
  # 示例：手动备份
  cp /opt/wechat-relay/data/db.json ~/db-backup-$(date +%Y%m%d).json
  ```
- **更新 Nginx/配置**：重新上传文件后 `docker compose restart nginx`

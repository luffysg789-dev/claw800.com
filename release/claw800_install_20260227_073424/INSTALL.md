# claw800 部署安装说明（给运维）

## 1. 服务器要求
- Ubuntu 22.04/24.04
- 域名已解析到服务器（如 `claw800.com`）
- 开放端口：22, 80, 443

## 2. 上传并解压安装包
```bash
mkdir -p /var/www/claw800
cd /var/www/claw800
# 上传 claw800_install_xxx.tar.gz 到这里

tar -xzf claw800_install_xxx.tar.gz
cd claw800_install_xxx
```

## 3. 一键安装依赖（需 root）
```bash
sudo bash install.sh
```

## 4. 配置管理员密码并启动
```bash
cd app
export ADMIN_PASSWORD='请替换为强密码'
bash ../start.sh
```

## 5. Nginx 配置
把 `nginx.claw800.conf` 放到：
`/etc/nginx/sites-available/claw800`

然后启用：
```bash
sudo ln -sf /etc/nginx/sites-available/claw800 /etc/nginx/sites-enabled/claw800
sudo nginx -t
sudo systemctl reload nginx
```

## 6. SSL（HTTPS）
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d claw800.com -d www.claw800.com
```

## 7. 常用运维命令
```bash
pm2 status
pm2 logs claw800
pm2 restart claw800
```

## 8. 数据文件
SQLite 数据库默认在：
`app/data/claw800.db`

请定时备份此文件。

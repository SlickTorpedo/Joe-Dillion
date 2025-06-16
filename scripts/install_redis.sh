# sudo apt install lsb-release curl gpg -y
# curl -fsSL https://packages.redis.io/gpg | sudo gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg 
# printf '%s\n' y
# echo 'deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main' | sudo tee /etc/apt/sources.list.d/redis.list 
# printf '%s\n' y
# sudo apt-get update -y
# sudo apt-get install redis -y
# redis-server --daemonize yes 
# printf '%s\n' y
# npm install redis
# echo 'Redis installed & initialized'

#Updated version!

sudo apt install lsb-release curl gpg -y
curl -fsSL https://packages.redis.io/gpg | sudo gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg 
echo 'deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main' | sudo tee /etc/apt/sources.list.d/redis.list 
sudo apt-get update -y
sudo apt-get install redis -y
redis-server --daemonize yes 
npm install redis
echo 'Redis installed & initialized'
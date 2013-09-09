require 'bundler/setup'
require 'sinatra/base'

# The project root directory
$root = ::File.dirname(__FILE__)

class SinatraStaticServer < Sinatra::Base

  get(/.+/) do
    send_sinatra_file(request.path) {404}
  end

  not_found do
    send_file(File.join(File.dirname(__FILE__), '404.html'), {:status => 404})
  end

  def send_sinatra_file(path, &missing_file_block)
    file_path = File.join(File.dirname(__FILE__),  path)
    if file_path =~ /\.[a-z]+$/i
      file_name = file_path
    else
      file_name = File.join(file_path, 'index.html')
      file_name = File.join(file_path, 'index.htm') unless File.exist?(file_name)
    end
    File.exist?(file_name) ? send_file(file_name) : missing_file_block.call
  end

end

run SinatraStaticServer

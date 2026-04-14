# andasy.hcl app configuration file generated for andy-next on Sunday, 22-Mar-26 23:49:39 CAT
#
# See https://github.com/quarksgroup/andasy-cli for information about how to use this file.

app_name = "andy-next"

app {

  env = {}

  port = 3000

  primary_region = "kgl"
  regions        = ["kgl", "fsn"]

  compute {
    cpu      = 1
    memory   = 256
    cpu_kind = "shared"
  }

  process {
    name = "andy-next"
  }

}

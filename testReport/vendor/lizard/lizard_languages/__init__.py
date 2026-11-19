''' programming languages of lizard '''

from .zig import ZigReader
from .clike import CLikeReader
# 本项目补丁：erlang / ocaml / fsharp 依赖 pygments；vendor 包里没带 pygments，
# 改为可选导入，缺少时这三种语言不可用，不影响 C/C++/Java/C#/Python/JS 等。
try:
    from .erlang import ErlangReader
except ImportError:  # pragma: no cover — 仅 Erlang 解析需要 pygments
    ErlangReader = None
from .java import JavaReader
from .javascript import JavaScriptReader
from .kotlin import KotlinReader
from .python import PythonReader
from .objc import ObjCReader
from .ttcn import TTCNReader
from .swift import SwiftReader
from .ruby import RubyReader
from .csharp import CSharpReader
from .dart import DartReader
from .php import PHPReader
from .scala import ScalaReader
from .gdscript import GDScriptReader
from .go import GoReader
from .lua import LuaReader
from .rust import RustReader
from .typescript import TypeScriptReader
from .fortran import FortranReader
from .solidity import SolidityReader
from .tsx import TSXReader
from .vue import VueReader
from .perl import PerlReader
from .st import StReader
from .r import RReader
from .plsql import PLSQLReader
from .cobol import CobolReader
try:
    from .ocaml import OCamlReader
except ImportError:  # pragma: no cover — 仅 OCaml 解析需要 pygments
    OCamlReader = None
try:
    from .fsharp import FSharpReader
except ImportError:  # pragma: no cover — 仅 F# 解析需要 pygments
    FSharpReader = None
from .gherkin import GherkinReader


def languages():
    readers = [
        CLikeReader,
        JavaReader,
        CSharpReader,
        JavaScriptReader,
        PythonReader,
        ObjCReader,
        TTCNReader,
        RubyReader,
        PHPReader,
        SwiftReader,
        ScalaReader,
        GDScriptReader,
        GoReader,
        LuaReader,
        RustReader,
        TypeScriptReader,
        FortranReader,
        KotlinReader,
        SolidityReader,
        ErlangReader,
        ZigReader,
        TSXReader,
        VueReader,
        PerlReader,
        StReader,
        RReader,
        PLSQLReader,
        CobolReader,
        DartReader,
        OCamlReader,
        FSharpReader,
        GherkinReader,
    ]
    # 可选语言缺失（未带 pygments）时跳过 None，其余照常。
    return [reader for reader in readers if reader is not None]


def get_reader_for(filename):
    for lan in languages():
        if lan.match_filename(filename):
            return lan
